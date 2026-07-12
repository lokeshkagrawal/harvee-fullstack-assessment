# API Documentation

Base URL: `https://harvee-fullstack-assessment.vercel.app/api`

All responses are JSON.

## API Conventions

### Success Response Format
```json
{
  "message": "Success message",
  "data": {}
}
```

### Error Response Format
```json
{
  "error": "Error message",
  "type": "validation_error | execution_error | not_found | server_error"
}
```

### Status Codes
- 200: OK
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 422: Validation Error
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
  "data": {
    "courseId": 1
  }
}
```

**GET /courses** — List all courses with reservation status
```json
{
  "data": {
    "courses": [
      {
        "course_id": 1,
        "course_name": "Computer Science",
        "total_seats": 10,
        "reservations": [
          { "category": "General", "reserved": 5, "filled": 3, "available": 2 },
          { "category": "OBC", "reserved": 3, "filled": 2, "available": 1 },
          { "category": "SC", "reserved": 1, "filled": 1, "available": 0 },
          { "category": "ST", "reserved": 1, "filled": 0, "available": 1 }
        ]
      }
    ]
  }
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
  "applicationDate": "2026-07-12",
  "preferences":[2][3][4]
}
// Response 201
{
  "message": "Student registered successfully",
  "data": {
    "studentId": 1
  }
}
```

**GET /students** — List all students with their preferences
```json
{
  "data": {
    "students": [
      {
        "studentId": 1,
        "name": "Aarav Sharma",
        "marks": 92,
        "category": "General",
        "applicationDate": "2026-07-12",
        "preferences":[3][4][2]
      }
    ]
  }
}
```

### Allocation Processing

**POST /allocation/process** — Runs the full allocation algorithm (idempotent — re-running recomputes from scratch)
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

**GET /allocation/results** — List of every student's final allocation status
```json
{
  "data": {
    "results": [
      {
        "studentId": 1,
        "studentName": "Aarav Sharma",
        "allocatedCourse": "Computer Science",
        "preferenceRank": 1,
        "status": "allocated"
      },
      {
        "studentId": 2,
        "studentName": "Riya Jain",
        "allocatedCourse": null,
        "preferenceRank": null,
        "status": "rejected"
      }
    ]
  }
}
```

**GET /allocation/dashboard** — Dashboard summary: totals, course-wise seat stats, category-wise breakdown
```json
{
  "data": {
    "totals": {
      "totalStudents": 10,
      "allocatedCount": 8,
      "rejectedCount": 2
    },
    "courseStats": [
      {
        "courseName": "Computer Science",
        "totalSeats": 10,
        "allocated": 8,
        "available": 2,
        "rejectionRate": 20
      }
    ],
    "categoryWiseAllocation": [
      { "category": "General", "allocated": 4 },
      { "category": "OBC", "allocated": 2 },
      { "category": "SC", "allocated": 1 },
      { "category": "ST", "allocated": 1 }
    ]
  }
}
```

### AI Assistant (Task 1 Analytics)

**POST /allocation/ask** — Ask a natural-language question about the allocation data
```json
// Request
{
  "question": "How many students were allocated to each course?"
}
// Response 200
{
  "question": "How many students were allocated to each course?",
  "sql": "SELECT ...",
  "columns": ["course_name", "count"],
  "rows": [],
  "rowCount": 3
}
```

Supported questions:
- How many students were allocated to each course?
- Which students did not receive their first preference?
- Which course had the highest rejection rate?
- Show category-wise allocation summary

If the question cannot be answered safely, the API returns:
```json
{
  "error": "Reason for rejection",
  "type": "validation_error"
}
```

---

## Task 2: AI SQL Assistant

### Dataset Upload

**POST /datasets/upload** — Upload a CSV/Excel file (`multipart/form-data`)
- Field name: `file` (required)
- Field name: `datasetName` (optional, defaults to filename)
```json
// Response 201
{
  "message": "Dataset uploaded and table created successfully",
  "data": {
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
  "data": {
    "datasets": [
      {
        "datasetId": 1,
        "datasetName": "sample_sales",
        "tableName": "ds_1_sample_sales",
        "rowCount": 20
      }
    ]
  }
}
```

**GET /datasets/:id** — Get a dataset's metadata + detected column schema
```json
{
  "data": {
    "datasetId": 1,
    "datasetName": "sample_sales",
    "tableName": "ds_1_sample_sales",
    "rowCount": 20,
    "schema": [
      { "columnName": "order_id", "type": "BIGINT" },
      { "columnName": "customer_name", "type": "TEXT" }
    ]
  }
}
```

### Prompt to SQL

**POST /datasets/:id/ask** — Ask a natural-language question about the dataset
```json
// Request
{
  "question": "Show top 5 customers by revenue"
}
// Response 200
{
  "question": "Show top 5 customers by revenue",
  "sql": "SELECT ... LIMIT 5",
  "columns": ["customer_name", "revenue"],
  "rows": [],
  "rowCount": 5
}
```

Only safe read-only queries are allowed. The AI-generated SQL is validated before execution.

If validation fails:
```json
{
  "error": "Only SELECT queries are permitted.",
  "type": "validation_error"
}
```

If execution fails:
```json
{
  "error": "Query execution failed: ...",
  "type": "execution_error"
}
```

**GET /datasets/:id/history** — Last 50 questions asked against this dataset, with generated SQL and success/failure status
```json
{
  "data": {
    "history": [
      {
        "question": "Show top 5 customers by revenue",
        "sql": "SELECT ...",
        "status": "success",
        "createdAt": "2026-07-12T10:00:00Z"
      }
    ]
  }
}
```

---

## Health Check

**GET /health** →
```json
{
  "status": "ok",
  "timestamp": "2026-07-12T11:00:00Z"
}
```

---

## Rate Limiting

All `/api/*` routes are limited to 60 requests/minute per client (configurable in `server.js`), primarily to protect the AI-calling endpoints from abuse.