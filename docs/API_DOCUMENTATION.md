# API Documentation

Base URL: `http://localhost:5000/api`

All responses are JSON. Errors follow the shape: `{ "error": "message" }`.

---

## Task 1: Student Course Allocation System

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
{ "message": "Course created successfully", "courseId": 1 }
```

**GET /courses** — List all courses with reservation status
```json
{
  "courses": [
    {
      "course_id": 1, "course_name": "Computer Science", "total_seats": 10,
      "reservations": [{ "category": "General", "reserved": 5, "filled": 3 }, ...]
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
  "preferences": [1, 2, 3]   // course_ids in priority order
}
// Response 201
{ "message": "Student registered successfully", "studentId": 1 }
```

**GET /students** — List all students with their preferences

### Allocation Processing

**POST /allocation/process** — Runs the full allocation algorithm (idempotent — re-running recomputes from scratch)
```json
{
  "message": "Allocation processed successfully",
  "summary": { "totalStudents": 10, "allocatedCount": 8, "rejectedCount": 2 }
}
```

**GET /allocation/results** — List of every student's final allocation status

**GET /allocation/dashboard** — Dashboard summary: totals, course-wise seat stats, category-wise breakdown

### AI Assistant (Task 1 Analytics)

**POST /allocation/ask** — Ask a natural-language question about the allocation data
```json
// Request
{ "question": "How many students were allocated to each course?" }
// Response 200
{
  "question": "...",
  "sql": "SELECT ...",
  "columns": ["course_name", "count"],
  "rows": [...],
  "rowCount": 3
}
// Response 422 (if AI cannot safely answer)
{ "error": "reason" }
```

Sample supported questions:
- "How many students were allocated to each course?"
- "Which students did not receive their first preference?"
- "Which course had the highest rejection rate?"
- "Show category-wise allocation summary"

---

## Task 2: AI SQL Assistant

**POST /datasets/upload** — Upload a CSV/Excel file (multipart/form-data)
- Field name: `file` (required)
- Field name: `datasetName` (optional label, defaults to filename)
```json
// Response 201
{
  "message": "Dataset uploaded and table created successfully",
  "dataset": {
    "datasetId": 1, "tableName": "ds_1_sample_sales", "rowCount": 20,
    "schema": [{ "originalName": "order_id", "columnName": "order_id", "type": "BIGINT" }, ...]
  }
}
```

**GET /datasets** — List all uploaded datasets

**GET /datasets/:id** — Get a dataset's metadata + detected column schema

**POST /datasets/:id/ask** — Ask a natural-language question about the dataset
```json
// Request
{ "question": "Show top 5 customers by revenue" }
// Response 200
{
  "question": "...", "sql": "SELECT ... LIMIT 5",
  "columns": [...], "rows": [...], "rowCount": 5
}
// Response 422 — validation failed (e.g. AI tried a non-SELECT query)
{ "error": "Only SELECT queries are permitted.", "type": "validation_error" }
// Response 400 — SQL executed but failed (e.g. unknown column referenced)
{ "error": "Query execution failed: ...", "type": "execution_error" }
```

**GET /datasets/:id/history** — Last 50 questions asked against this dataset, with generated SQL and success/failure status

---

## Health Check

**GET /health** → `{ "status": "ok", "timestamp": "..." }`

---

## Rate Limiting

All `/api/*` routes are limited to 60 requests/minute per client (configurable in `server.js`), primarily to protect the AI-calling endpoints from abuse.
