# Architecture Document

## 1. Overview

This project implements two AI-integrated full stack applications sharing a common
tech foundation:

- **Frontend:** React.js (Vite) — single-page app with tab-based navigation
- **Backend:** Node.js + Express, layered as Routes → Controllers → Services
- **Database:** PostgreSQL
- **AI:** Gemini API (Google AI Studio), used for natural-language-to-SQL translation in
  both tasks

Both tasks share the same core pattern: **generate SQL from a natural language
question using Gemini, strictly validate it, execute it read-only, and return
results.** This shared pattern (`aiSqlService.js` for Task 2, mirrored in
`allocationAiAssistant.js` for Task 1) was a deliberate reuse decision — it kept
the AI integration logic consistent and let Task 1's "AI Assistant" reporting
feature be built quickly on top of infrastructure already proven in Task 2.

---

## 2. Assumptions Made

The assessment document did not provide a contact email for clarification
(despite instructing candidates to use one), so the following assumptions were
made and documented here rather than left implicit:

1. **Unfilled reserved seats are NOT auto-converted to General seats.** Reservation
   quotas are protected — if an OBC quota isn't fully used, those seats stay
   reserved and unfilled rather than being handed to General category students.
   However, the reverse is allowed: a reserved-category student may take a
   **General** seat if their own category's quota is full but General seats
   remain (mirrors real-world admission counselling practice).
2. **A student can only be allocated one course** — enforced at the database
   level via a `UNIQUE` constraint on `allocations.student_id`.
3. **AI-generated SQL is restricted to read-only SELECT statements** for both
   tasks — this was treated as non-negotiable for security, not left as an
   open question (see Security section).
4. **Submission format:** code lives in a GitHub-ready repo structure; this
   document set (README, API docs, architecture doc) serves as the "document
   containing your work" for upload, alongside the repo link.
5. **Dataset size for Task 2 demo:** kept small (~20 rows) for the sample
   dataset, but the ingestion pipeline (batched inserts, dynamic typing) is
   written to scale to much larger files without code changes.
6. **A single uploaded file = a single flat table.** Multi-sheet Excel files
   use only the first sheet — multi-table relational uploads were considered
   out of scope for "upload a dataset and query it."

---

## 3. Database Design Decisions

- **Task 1** uses a fully normalized schema: `course_reservations` is a separate
  table (course_id, category, reserved_seats, filled_seats) rather than fixed
  columns like `general_seats, obc_seats, ...` on `courses`. This avoids schema
  changes if categories are added later and makes seat-tracking queries simple
  joins rather than column-by-column logic.
- `student_preferences` stores one row per (student, priority) rather than
  three fixed columns (`pref1, pref2, pref3`) — same reasoning: variable-length
  preference lists without schema changes.
- **Task 2** cannot use a fixed schema at all, since the whole point is
  arbitrary uploaded data. Instead, `datasets` + `dataset_columns` store
  *metadata* about each upload, while the actual data lives in a table created
  dynamically at runtime (named `ds_<id>_<label>`). This keeps metadata
  queryable/joinable while letting actual data tables have arbitrary shapes.
- `query_history` in Task 2 logs every question asked, the SQL Gemini generated,
  whether it passed validation, and whether execution succeeded — this doubles
  as an audit trail and a debugging tool during development.

---

## 4. AI Integration Approach

Both AI features follow the same three-stage pipeline:

1. **Prompt Gemini with a strict system prompt** containing only the exact
   schema (table/column names) relevant to the question, plus hard rules:
   SELECT-only, no markdown fences, return `UNSUPPORTED_QUERY` if the question
   can't be answered from this schema.
2. **Validate the returned SQL programmatically** before touching the database
   (see Security section) — the AI's own claim that it followed the rules is
   never trusted blindly.
3. **Execute and return structured results** (columns + rows), never raw text
   summaries, so the frontend can render results as a table regardless of the
   question asked.

This "narrow schema context + strict validation layer" design was chosen over
giving the AI direct database access or broader tool-use, specifically to keep
the blast radius of a bad or adversarial prompt limited to a read-only SELECT
against known tables.

---

## 5. Security Considerations

AI-generated SQL is the single biggest risk surface in this project, so it
received the most deliberate design attention:

- **SELECT-only enforcement**, checked twice: once in the Gemini system instruction
  (soft constraint) and once programmatically in `validateSql()` (hard
  constraint, cannot be bypassed by prompt injection in the uploaded data or
  the user's question).
- **Forbidden keyword blocklist** (`INSERT, UPDATE, DELETE, DROP, ALTER,
  TRUNCATE, CREATE, GRANT, REVOKE, COPY, ...`) checked with word-boundary
  regex against the generated SQL string.
- **Single-statement enforcement** — generated SQL is rejected if it contains
  a `;` before the end, preventing stacked-query injection.
- **Table allow-listing** — Task 2 queries must reference the exact dynamically
  created table for that dataset; Task 1 queries must reference one of the five
  known allocation tables. The AI cannot query `pg_catalog`, other datasets'
  tables, or anything outside its assigned scope.
- **Every generated query is logged** (`query_history`) with a validity flag,
  so any bypass attempt or repeated failure pattern is auditable after the fact.
- **Rate limiting** (60 req/min per client) on all `/api` routes, mainly to
  control cost and abuse of the AI-calling endpoints.
- **Production Roadmap (Defense-in-Depth):** While the application layer 
    fully guarantees safety via string parsing and regex validation, 
    a production-grade environment would ideally execute these queries 
    using a dedicated PostgreSQL role restricted strictly to `SELECT` privileges.

---

## 6. Challenges Faced & Solutions

1. **Dynamic table creation with unpredictable input.** CSV/Excel column names 
     can contain spaces, symbols, or start with digits — none of which are valid 
     Postgres identifiers. Solved with a `sanitizeColumnName()` function that 
     normalizes names and de-duplicates collisions (e.g. two columns both 
     sanitizing to `date` become `date` and `date_1`).
2. **Type inference from loosely-typed spreadsheet data.** CSV values are all 
     strings by default. Built a sampling-based type inferrer (`inferColumnType`) 
     that checks the first 200 non-null values against integer/numeric/boolean/
     date patterns before falling back to TEXT, balancing accuracy against not 
     scanning entire large files just to create a table.
3. **Preventing AI SQL injection / unsafe queries.** Addressed via the layered 
     validation approach described in the Security section above — this was the 
     single most important design problem in the whole assessment given both 
     tasks fundamentally hand a natural-language input to an LLM that then 
     produces SQL to execute.
4. **Handling LLM Rate Limits & Server Crashes (Critical Bug Fixed):** During 
     heavy testing of the AI Assistant, the Gemini API threw a `429 Too Many 
     Requests` quota error. This initially triggered an unhandled promise rejection, 
     causing the Node.js event loop to panic and crash the backend server 
     (`uv_handle_closing` error).
   - *Solution:* Refactored the AI query services with rigorous inner `try-catch` 
      blocks, mapping LLM failures into clean user-friendly HTTP errors 
(`429 Rate Limit`), and hooked them into the Express global error-handling 
      middleware to make the backend completely resilient and crash-proof.
5. **Allocation algorithm correctness with reservation edge cases.** Needed a clear, 
     documented rule for what happens when a reserved-category quota is full but the 
     course still has open General seats. Resolved by implementing real-world 
     admission counseling logic: reserved students can claim General seats if their 
     marks clear the General cutoff.
6. **Idempotent allocation runs.** Since "Run Allocation" can be clicked 
     multiple times as data changes, `runAllocation()` resets all previous 
     allocations and filled-seat counters at the start of each run inside a 
     single atomic transaction, avoiding double-counting or stale results.

---

## 7. What Was Deliberately Left Out of Scope

- **Authentication & Authorization:** (Not requested in the core assessment brief; left out to focus strictly on database correctness and AI implementation within the timeline).
- **Multi-sheet Excel Ingestion:** Multi-table relational uploads were considered out of scope for a generic single-dataset query tool; hence, only the first sheet of an uploaded workbook is parsed.

---

## 8. Deployment & Live URLs (Bonus Advantage)

Though listed as optional in the evaluation brief, the entire pipeline has been fully deployed to cloud infrastructure to demonstrate production readiness:
- **Backend Service:** Live on **Render** (Node.js/Express + Hosted PostgreSQL)
- **Frontend Application:** Live on **Vercel** (React/Vite SPA)
- **Database Schema Execution:** Automated and verified directly against the live remote instance.
      