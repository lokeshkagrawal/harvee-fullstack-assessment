const pool = require('../config/db');
const {getModel} = require('../config/aiClient');
const {getDatasetById} = require('./datasetService');
const { BlockReason } = require('@google/generative-ai');

// Keywords that must never appear in AI-generated SQL. This is a defense-in-depth
// layer on top of using a read-only DB role in production.
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE',
  'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL', '--', ';--', 'COPY',
  'ATTACH', 'DETACH', 'REPLACE', 'MERGE',
];


/**
 * Builds a schema description string to give Gemini context about the dataset.
 */

function buildSchemaContext(dataset)
{
    const cols = dataset.columns.map((c) => `   - ${c.column_name} (${c.inferred_type})`).join('\n');
    return `Table name: "${dataset.table_name}"\nColumns:\n${cols}\nTotal rows: ${dataset.row_count}`;

}


/**
 * Calls Gemini to translate a natural language question into a single PostgreSQL
 * SELECT statement, constrained to the given table/schema.
 */
async function generateSql(question, dataset) {
    const schemaContext = buildSchemaContext(dataset);

    const systemPrompt = `You are a PostgreSQL query generator. You convert natural language questions into a SINGLE valid PostgreSQL SELECT query.

STRICT RULES:
1. Only generate SELECT statements. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, or any other DDL/DML.
2. Only reference the table and columns given below. Do not invent column names.
3. Always wrap the table name in double quotes exactly as given.
4. Return ONLY the raw SQL query, no explanation, no markdown code fences, no semicolon at the end.
5. If the question cannot be answered with a SELECT query on this table, return exactly: UNSUPPORTED_QUERY
6. Add a LIMIT 100 clause unless the question explicitly asks for aggregate/summary results (like counts, sums, averages) or explicitly requests more.

Schema:
${schemaContext}`;

    const model = getModel(systemPrompt);

    try {
        const result = await model.generateContent(question);
        const rawText = String(result?.response?.text?.() || '').trim();
        return rawText.replace(/```sql|```/g, '').trim();
    } catch (err) {
        if (err?.status === 429 || err?.statusCode === 429 || String(err?.message).includes('429')
            || String(err?.message).toUpperCase().includes('QUOTA') || String(err?.message).toUpperCase().includes('EXHAUSTED')) {
            const e = new Error('AI quota exhausted. Please try again later.');
            e.isQuotaError = true;
            throw e;
        }
        throw err;
    }
}


/**
 * Validates that a generated SQL string is a safe, single, read-only SELECT statement.
 */
function validateSql(sql, expectedTableName){
    if(!sql || sql === 'UNSUPPORTED_QUERY'){
        return {valid: false, reason: 'AI determined this question cannot be answered as a SQL query on this dataset.' };
    }
    const trimmed = sql.trim();
    
      // Must start with SELECT (case-insensitive), allowing leading WITH for CTEs
      if(!/^(SELECT|WITH)\s/i.test(trimmed)){
        return {valid:false, reason: 'Only SELECT queries are permitted.'}
      }
    
     // Disallow multiple statements (basic stacked-query protection)
     const withoutTraillingSemi = trimmed.replace(/;\s*$/,'');
     if(withoutTraillingSemi.includes(';')){
        return {valid:false, reason:'Multiple statements are not permitted'};
     }

     const upper =trimmed.toUpperCase();
     for(const keyword of FORBIDDEN_KEYWORDS){
        // word-boundary check to avoid false positives on substrings
        const pattern = new RegExp(`\\b${keyword}\\b`,'i');
        if(pattern.test(upper)){
            return {valid:false, reason:`Forbidden keyword detected: ${keyword}`}
        }
     }
     if(!trimmed.includes(expectedTableName))
        return {valid:false, reason:'Qurey dose not reference the expected dataset table.'};

     return {valid:true};
}


/**
 * Full pipeline: question -> generated SQL -> validate -> execute -> log -> return results.
 */
async function askDataset(datasetId, question) {
    const dataset = await getDatasetById(datasetId);
    if (!dataset) {
        throw new Error('Dataset not found');
    }

    const generatedSql = await generateSql(question, dataset);
    const validation = validateSql(generatedSql, dataset.table_name);

    if (!validation.valid) {
        await pool.query(`INSERT INTO query_history(dataset_id, user_question, generated_sql, was_valid, error_message) 
            VALUES($1,$2,$3,false,$4)`, [datasetId, question, generatedSql, validation.reason]);
        const err = new Error(validation.reason);
        err.isValidationError = true;
        throw err;
    }

    try{
        const cleanSql = generatedSql.replace(/;\s*$/,'');
        const result = await pool.query(cleanSql);

        await pool.query(`
            INSERT INTO query_history(dataset_id,user_question, generated_sql, was_valid, row_count_returned)
            VALUES($1, $2, $3, true, $4)`, [datasetId,question,generatedSql,result.rowCount ]);
        
        return {question, sql:generatedSql, columns:result.fields.map((c)=>c.name), rows:result.rows, rowsCount:result.rowCount};
    }
    catch(dbErr)
    {
        await pool.query(`INSERT INTO query_history(dataset_id,user_question, generated_sql, was_valid, error_message)
            VALUES($1,$2,$3,false,$4)`,[datasetId, question, generatedSql,dbErr.message]);
        const err = new Error(`Query execution failed, ${dbErr.message}`);
        err.isExecutionError = true;
        throw err;
    }
}

async function getQueryHistorty(datasetId){
    const result = await pool.query(`SELECT * FROM query_history where dataset_id = $1 ORDER BY executed_at DESC LIMTI 50`,[datasetId]);
    return  result.rows;
}

module.exports = {askDataset, getQueryHistorty, validateSql, generateSql}
