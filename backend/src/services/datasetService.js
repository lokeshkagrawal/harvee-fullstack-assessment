const pool = require('../config/db');
const {parseFileBuffer, detectSchema} = require('./schemaDetectionService');

/**
 * Generates a safe, unique table name for a new dataset.
 */
function buildTableName(datasetId, datasetName){
    const safe = datasetName.toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
    return `ds_${datasetId}_${safe || 'data'}`;
}

/**
 * Casts a raw CSV/Excel cell value to match the inferred column type before insert.
 */


function castValue(value, type){
    if(value === null || value === undefined || value === '') return null;

    switch(type)
    {
        case 'BIGINT':
            return parseInt(value, 10);
        case 'NUMERIC':
            return parseFloat(value);
        case 'BOOLEAN':
            return ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());
        case 'DATE':
            return new Date(value).toISOString().slice(0,10);
        default:
            return String(value);
    }
}

/**
 * Full pipeline: parse file -> detect schema -> create dataset row -> create dynamic table
 * -> bulk insert data -> record column metadata.
 */

async function ingestDataset(fileBuffer, originalFilename, datasetLabel)
{
    const rows = parseFileBuffer(fileBuffer, originalFilename);
    const schema = detectSchema(rows);

    const client  = await pool.connect();

    try{
        await client.query('BEGIN');

        // 1. Insert dataset metadata row (table_name filled in after we know dataset_id)
        const dsInsert = await client.query(`INSERT INTO datasets (dataset_name, table_name, original_filename, row_count)
            VALUES ($1, 'pending', $2, $3) RETURNING dataset_id`,[datasetLabel, originalFilename, rows.length]);
        const datasetId = dsInsert.rows[0].dataset_id;
        const tableName   = buildTableName(datasetId, datasetLabel);

        await client.query(`UPDATE datasets SET table_name = $1 where dataset_id = $2`, [tableName, datasetId]);
    
    // 2. Create the dynamic table
     const columnDefs = schema.map((col) => `"${col.columnName}" ${col.type}`).join(', ');
     await client.query(`CREATE TABLE "${tableName}" (row_id SERIAL PRIMARY KEY, ${columnDefs})`);

    // 3. Record column metadata
     for(let i =0 ; i<schema.length; i++){
        const col = schema[i];
        await client.query(`INSERT INTO dataset_columns(dataset_id, column_name, inferred_type, ordinal_position) 
            VALUES($1,$2,$3,$4)`,[datasetId, col.columnName, col.type, i+1]);
    }


    // 4. Bulk insert rows (batched to avoid parameter limit issues)
    const colNames = schema.map((c) => `"${c.columnName}"`).join(', ');
    const BATCH_SIZE = 500;
    for( let i=0; i<rows.length; i+=BATCH_SIZE){
        const batch = rows.slice(i, i+ BATCH_SIZE);
        const valuePlaceholders = [];
        const values =[];
        let paramIndex = 1;
        for(const row of batch){
            const rowPlaceholders = schema.map((col)=>{
            values.push(castValue(row[col.originalName], col.type));
            return `$${paramIndex++}`;    
        });
        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    }   
    await client.query(`INSERT INTO "${tableName}" (${colNames}) VALUES ${valuePlaceholders.join(', ')}`, values);
    }
    await client.query('COMMIT');

    return{
      datasetId, tableName, rowCount: rows.length, schema };
    } catch (err) {
    await client.query('ROLLBACK');
    throw err;
    } finally {
    client.release();
    }
}

async function getDatasetById(datasetId){
    const result = await pool.query(`SELECT * FROM datasets WHERE dataset_id = $1`,[datasetId]);
    if(result.rows.length === 0) return null;

    const columns = await pool.query(`SELECT column_name, inferred_type, ordinal_position FROM dataset_columns WHERE dataset_id =$1 ORDER BY ordinal_position`,[datasetId]);

    return {...result.rows[0], columns: columns.rows};
}


async function listDatasets(){
    const result = await pool.query(`SELECT dataset_id, dataset_name, table_name, original_filename, row_count, uploaded_at FROM datasets ORDER BY uploaded_at DESC`);

    return result.rows;
}

module.exports = {ingestDataset, getDatasetById, listDatasets};