const {parse} = require('csv-parse/sync');
const XLSX = require('xlsx');

/**
 * Parses an uploaded file buffer (CSV or Excel) into an array of row objects.
 */
function parseFileBuffer(buffer,originalFilename)
{
    const ext = originalFilename.split('.').pop().toLowerCase();

    if(ext === 'csv'){
        const records = parse(buffer,{
            columns: true,
            skip_empty_lines: true,
            trim:true,
        });
        return records;
    }

    if(ext === 'xlsx' || ext === 'xls'){
        const workbook = XLSX.read(buffer,{
            type:'buffer'
        });
        const firstSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheet];
        const records = XLSX.utils.sheet_to_json(sheet,{
            defval :null,
            raw : false,
        })
        return records;
    }
    
    throw new Error('Unsupported file type. Use CSV or Excel.');
}

/**
 * Sanitizes a raw column name into a safe SQL identifier.
 * e.g. "Customer Name (2024)" -> "customer_name_2024"
 */

function sanitizeColumnName(name){
    let clean  = name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g,'_')
    .replace(/^_+|_+$/g,'');
    if(!clean) clean = 'col';
    if(/^[0-9]/.test(clean)) clean =  `c_${clean}`;
    return clean;
}

/**
 * Infers a Postgres-compatible type for a column based on sample values.
 * Priority: INTEGER > NUMERIC > DATE > BOOLEAN > TEXT
 */

function inferColumnType(values){
    const nonNull = values.filter((v)=> v !== null && v !== undefined && v !== '');
    if(nonNull.length === 0) return 'TEXT';

    const isInt = nonNull.every((v)=> /^-?\d+$/.test(String(v).trim()));
    if(isInt) return 'BIGINT'; 

    const isNumeric = nonNull.every((v)=> /^-?\d+(\.\d+)?$/.test(String(v).trim()));
    if(isNumeric) return 'NUMERIC'; 

    const isBoolean = nonNull.every((v)=> ['true','false','1','0','yes','no'].includes(String(v).trim().toLowerCase()));
    if(isBoolean) return 'BOOLEAN';
    
    const isDate = nonNull.every((v)=> !isNaN(Date.parse(v)));
    if(isDate && nonNull.length > 0 ) return 'DATE'; 

    return 'TEXT';
}

/**
 * Given parsed rows, produces a detected schema: [{ originalName, columnName, type }]
 */

function detectSchema(rows){
    if(!rows || rows.length === 0 ) {
        throw new Error('File contains no data rows');
    }

    const originalColumns = Object.keys(rows[0]);
    const usedName = new Set();

    const schema = originalColumns.map((originalName) =>{
        let columnName = sanitizeColumnName(originalName);
        //handle duplicate sanitize name
        let suffix = 1;
        let finalName = columnName;
        while(usedName.has(finalName)){
            finalName = `${columnName}_${suffix++}`;
        }
        usedName.add(finalName);

        const sampleValues = rows.slice(0,200).map((r)=>r[originalName]);
        const type = inferColumnType(sampleValues);

        return {originalName, columnName:finalName, type};
        
    });
    return schema;
}

module.exports = { parseFileBuffer, detectSchema, sanitizeColumnName };