# API Documentation

**Live Base URL:** `https://harvee-fullstack-assessment.onrender.com/api`
**Local Base URL:** `http://localhost:5000/api`

All responses are JSON. Response shapes below are taken directly from the controllers, not idealized — they match what the live API actually returns.

## API Conventions

### Success Response Format
Responses are **not** wrapped in a generic `data` envelope. Each endpoint returns its payload directly at the top level, alongside a `message` field where relevant (e.g. `{ "message": "...", "courseId": 1 }`). See each endpoint below for its exact shape.

### Error Response Format
```json
{ "error": "Error message", "type": "validation_error | execution_error" }
```
`type` is only present for validation/execution errors from the AI-to-SQL pipeline. Generic errors return just `{ "error": "..." }`.

**Note:** AI quota-exhausted errors (HTTP 429) currently use a `message` key instead of `error` for the response body (`{ "message": "AI quota exhausted. Please try again later." }`) — an intentional-but-inconsistent choice carried over from the original error handler; worth normalizing to `error` in a future cleanup pass.

### Status Codes
- 200: OK
- 201: Created
- 400: Bad Request
- 404: Not Found
- 422: Validation Error (AI-generated SQL rejected)
- 429: AI quota exhausted
- 500: Internal Server Error

---

## Task 1: Student Course Allocation System

### Business Rules
- Students with higher marks receive higher priority.
- If marks are equal, the earlier application date gets priority.
- A student can be allocated only one course.
- If the first preference is unavailable, the system checks the next preference.
- Reservation rules are applied category-wise during allocation.

### Course Management

**POST /courses** — Create a course with category-wise reserved seats
```json
// Request
{
  "courseName": "Computer Science",
  "totalSeats": 10,
  "reservations": [
    { "category": "General", "seats": 5 },
    { "category": "OBC", "seats": 3 },
    { "category": "SC", "seats": 1 },
    { "category": "ST", "seats": 1 }
  ]
}
// Response 201
{
  "message": "Course created successfully",
  "courseId": 1
}
```

**GET /courses** — List all courses with reservation status
```json
{
  "courses": [
    {
      "course_id": 1,
      "course_name": "Computer Science",
      "total_seats": 10,
      "reservations": [
        { "category": "General", "reserved": 5, "filled": 3 },
        { "category": "OBC", "reserved": 3, "filled": 2 }
      ]
    }
  ]
}
```

### Student Registration

**POST /students** — Register a student with ranked course preferences
```json
// Request
{
  "name": "Aarav Sharma",
  "marks": 92,
  "category": "General",
  "preferences": [2, 3, 4]
}
// preferences is an array of course_ids, in priority order.
// application_date is set automatically by the database (CURRENT_TIMESTAMP) — do not send it.

// Response 201
{
  "message": "Student registered successfully",
  "studentId": 1
}
```

**GET /students** — List all students with their preferences
```json
{
  "students": [
    {
      "student_id": 1,
      "name": "Aarav Sharma",
      "marks": 92,
      "category": "General",
      "application_date": "2026-07-12T10:00:00.000Z",
      "preferences": [
        { "course_id": 2, "priority": 1 },
        { "course_id": 3, "priority": 2 }
      ]
    }
  ]
}
```

### Allocation Processing

**POST /allocation/process** — Runs the full allocation algorithm (idempotent — re-running recomputes from scratch across the entire current applicant pool; see Architecture Document, Section 2, point 3, for what this means if new students are added between runs)
```json
{
  "message": "Allocation processed successfully",
  "summary": {
    "totalStudents": 10,
    "allocatedCount": 8,
    "rejectedCount": 2
  }
}
```

**GET /allocation/results** — Every student's final allocation status
```json
{
  "results": [
    {
      "allocation_id": 1,
      "student_id": 1,
      "name": "Aarav Sharma",
      "marks": 92,
      "category": "General",
      "course_name": "Computer Science",
      "allocated_priority": 1,
      "status": "ALLOCATED"
    },
    {
      "allocation_id": 2,
      "student_id": 2,
      "name": "Riya Jain",
      "marks": 60,
      "category": "General",
      "course_name": null,
      "allocated_priority": null,
      "status": "REJECTED"
    }
  ]
}
```

**GET /allocation/dashboard** — Dashboard summary: totals, course-wise seat stats, category-wise breakdown
```json
{
  "totalAllocated": 8,
  "totalRejected": 2,
  "courseStats": [
    {
      "course_id": 1,
      "course_name": "Computer Science",
      "total_seats": 10,
      "total_reserved": 10,
      "total_filled": 8
    }
  ],
  "categoryWise": [
    { "category": "General", "allocated": 4, "rejected": 1 },
    { "category": "OBC", "allocated": 2, "rejected": 1 }
  ]
}
```

### AI Assistant (Task 1 Analytics)

**POST /allocation/ask** — Ask a natural-language question about the allocation data
```json
// Request
{ "question": "How many students were allocated to each course?" }

// Response 200
{
  "question": "How many students were allocated to each course?",
  "sql": "SELECT c.course_name, COUNT(*) ...",
  "columns": ["course_name", "count"],
  "rows": [{ "course_name": "Computer Science", "count": "8" }],
  "rowCount": 3
}
```

Supported example questions:
- How many students were allocated to each course?
- Which students did not receive their first preference?
- Which course had the highest rejection rate?
- Show category-wise allocation summary

If the question cannot be answered safely:
```json
{ "error": "Only SELECT queries are permitted.", "type": "validation_error" }
```

If the Gemini API quota is exhausted:
```json
{ "message": "AI quota exhausted. Please try again later." }
```
(returned with HTTP 429 — note this uses `message`, not `error`, see the note under API Conventions above)

**Note:** Task 1 AI Assistant answers are not currently persisted to `query_history` (that table is scoped to Task 2 datasets only — see Database Schema Document).

---

## Task 2: AI SQL Assistant

### Dataset Upload

**POST /datasets/upload** — Upload a CSV/Excel file (`multipart/form-data`)
- Field name: `file` (required)
- Field name: `datasetName` (optional, defaults to the filename without extension)
```json
// Response 201
{
  "message": "Dataset uploaded and table created successfully",
  "dataset": {
    "datasetId": 1,
    "tableName": "ds_1_sample_sales",
    "rowCount": 20,
    "schema": [
      { "originalName": "order_id", "columnName": "order_id", "type": "BIGINT" },
      { "originalName": "customer_name", "columnName": "customer_name", "type": "TEXT" }
    ]
  }
}
```

**GET /datasets** — List all uploaded datasets
```json
{
  "datasets": [
    {
      "dataset_id": 1,
      "dataset_name": "sample_sales",
      "table_name": "ds_1_sample_sales",
      "original_filename": "sample_sales.csv",
      "row_count": 20,
      "uploaded_at": "2026-07-12T10:00:00.000Z"
    }
  ]
}
```

**GET /datasets/:id** — Get a dataset's metadata + detected column schema
```json
{
  "dataset": {
    "dataset_id": 1,
    "dataset_name": "sample_sales",
    "table_name": "ds_1_sample_sales",
    "original_filename": "sample_sales.csv",
    "row_count": 20,
    "uploaded_at": "2026-07-12T10:00:00.000Z",
    "columns": [
      { "column_name": "order_id", "inferred_type": "BIGINT", "ordinal_position": 1 },
      { "column_name": "customer_name", "inferred_type": "TEXT", "ordinal_position": 2 }
    ]
  }
}
```

### Prompt to SQL

**POST /datasets/:id/ask** — Ask a natural-language question about the dataset
```json
// Request
{ "question": "Show top 5 customers by revenue" }

// Response 200
{
  "question": "Show top 5 customers by revenue",
  "sql": "SELECT customer_name, SUM(price*quantity) AS revenue FROM \"ds_1_sample_sales\" GROUP BY customer_name ORDER BY revenue DESC LIMIT 5",
  "columns": ["customer_name", "revenue"],
  "rows": [{ "customer_name": "Rahul Sharma", "revenue": "113000" }],
  "rowCount": 5
}
```

Only safe, read-only SELECT queries are allowed. The AI-generated SQL is validated (SELECT-only, no forbidden keywords, single statement, correct table reference) before execution.

If validation fails:
```json
{ "error": "Only SELECT queries are permitted.", "type": "validation_error" }
```

If execution fails:
```json
{ "error": "Query execution failed: column \"xyz\" does not exist", "type": "execution_error" }
```

If the Gemini API quota is exhausted:
```json
{ "message": "AI quota exhausted. Please try again later." }
```
(HTTP 429)

**GET /datasets/:id/history** — Last 50 questions asked against this dataset
```json
{
  "history": [
    {
      "query_id": 1,
      "dataset_id": 1,
      "user_question": "Show top 5 customers by revenue",
      "generated_sql": "SELECT ...",
      "was_valid": true,
      "error_message": null,
      "row_count_returned": 5,
      "executed_at": "2026-07-12T10:05:00.000Z"
    }
  ]
}
```

---

## Health Check

**GET /health**
```json
{ "status": "ok", "timestamp": "2026-07-12T11:00:00.000Z" }
```
(Not under `/api` — call it directly at the base domain, e.g. `https://harvee-fullstack-assessment.onrender.com/health`)

---

## Rate Limiting

All `/api/*` routes are limited to 60 requests/minute per client (configured in `server.js`), primarily to protect the AI-calling endpoints from abuse and control Gemini API cost.

## Live Deployment

- **Backend (this API):** `https://harvee-fullstack-assessment.onrender.com`
- **Frontend:** `https://harvee-fullstack-assessment.vercel.app`

Note: the backend is hosted on Render's free tier, which sleeps after ~15 minutes of inactivity. The first request after a period of inactivity may take 30–50 seconds while the service wakes up — this is expected free-tier behavior, not an error.
