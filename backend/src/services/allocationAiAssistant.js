const pool = require('../config/db');
const { getModel } = require('../config/aiClient');
const { validateSql } = require('./aiSqlService');

// Fixed schema context for the allocation system — reused across every question,
// since (unlike Task 2) this schema never changes.
const ALLOCATION_SCHEMA_CONTEXT = `
Tables:
1. students (student_id, name, marks, category, application_date)
2. courses (course_id, course_name, total_seats)
3. course_reservations (reservation_id, course_id, category, reserved_seats, filled_seats)
4. student_preferences (preference_id, student_id, course_id, priority)
5. allocations (allocation_id, student_id, course_id, allocated_priority, status)
   -- status is one of 'ALLOCATED', 'REJECTED', 'PENDING'
   -- allocated_priority = 1 means the student got their FIRST preference

Relationships: allocations.student_id -> students.student_id,
allocations.course_id -> courses.course_id,
student_preferences.student_id -> students.student_id,
student_preferences.course_id -> courses.course_id.
`;

async function generateAllocationSql(question) {
  const systemPrompt = `You are a PostgreSQL query generator for a student course allocation system.
Convert the natural language question into a SINGLE valid PostgreSQL SELECT query using ONLY the tables/columns below.

STRICT RULES:
1. Only SELECT statements. Never INSERT/UPDATE/DELETE/DDL.
2. Return ONLY the raw SQL, no markdown fences, no explanation, no trailing semicolon.
3. If unanswerable with these tables, return exactly: UNSUPPORTED_QUERY
4. Add LIMIT 100 unless the question is asking for an aggregate/summary.

${ALLOCATION_SCHEMA_CONTEXT}`;

  const model = getModel(systemPrompt);

  try {
    const result = await model.generateContent(question);
    const rawText = String(result?.response?.text?.() || '').trim();
    return rawText.replace(/```sql|```/g, '').trim();
  } catch (err) {
    if (err?.status === 429 || err?.statusCode === 429 || String(err?.message).includes('429') 
        || String(err?.message).toUpperCase().includes('QUOTA') || String(err?.message).toUpperCase().includes('EXHAUSTED') ) {
      const e = new Error('AI quota exhausted. Please try again later.');
      e.isQuotaError = true;
      throw e;
    }
    throw err;
  }
}

async function askAllocationAssistant(question) {
  let sql;
  try {
    sql = String(await generateAllocationSql(question)).trim();

  } catch (aiErr) {
    if (aiErr.isQuotaError) {
      throw aiErr;
    }
    const err = new Error(`AI generation failed: ${aiErr.message}`);
    err.isGenerationError = true;
    throw err;
  }

    // Reuse the same validation logic from Task 2 (SELECT-only, no forbidden keywords),
    // but check against any of our known table names rather than a single dynamic one.
  const KNOWN_TABLES = [
    'students',
    'courses',
    'course_reservations',
    'student_preferences',
    'allocations',
  ];
    const referencesKnownTable = KNOWN_TABLES.some((t) => sql.toLowerCase().includes(t));
  if (!sql || sql === 'UNSUPPORTED_QUERY') {
    const err = new Error('This question cannot be answered from the allocation data');
    err.isValidationError = true;
    throw err;
  }

  if (!/^(SELECT|WITH)\s/i.test(sql)) {
    const err = new Error('Only SELECT queries are permitted.');
    err.isValidationError = true;
    throw err;
  }

     if(!referencesKnownTable){
    const err = new Error('Query does not reference known allocation tables.');
    err.isValidationError = true;
    throw err;
  }

  const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;
  if (forbidden.test(sql)) {
    const err = new Error('Forbidden keyword detected in generated query.');
    err.isValidationError = true;
    throw err;
  }

  const cleanSql = sql.replace(/;\s*$/, '');

  try {
    const result = await pool.query(cleanSql);
    return {
      question,
      sql: cleanSql,
      columns: result.fields?.map((f) => f.name) || [],
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
    };
  } catch (dbErr) {
    const err = new Error(`Query execution failed: ${dbErr.message}`);
    err.isExecutionError = true;
    throw err;
  }
}

module.exports = { askAllocationAssistant };