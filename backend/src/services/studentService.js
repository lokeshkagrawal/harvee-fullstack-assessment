const pool = require('../config/db');

async function registerStudent({name, marks, category, preferences}){
    if(!name || marks === undefined || !category || !Array.isArray(preferences) || preferences.length === 0){
        const err = new Error('name, marks, category and at least one preference are required.');
        err.isValidationError = true;
        throw err;
    }

    const client = await pool.connect();
    try {
            await client.query('BEGIN');

            const studetnResult = await client.query(`INSERT INTO students(name, marks, category) VALUES($1,$2,$3) RETURNING student_id`,[name, marks, category]);
            const studentId = studetnResult.rows[0].student_id;

            for(let i = 0; i< preferences.length; i++ ){
                await client.query(`INSERT INTO student_preferences(student_id, course_id, priority) VALUES($1,$2,$3)`,[studentId, preferences[i],i+1]);
            }
            await client.query('COMMIT');
            return({studentId});
    } catch (err) {
            await client.query('ROLLBACK');
            throw err;     
    }
    finally{
        client.release();
    }
}

async function listStudents(){
    const result = await pool.query(`SELECT s.student_id, s.name, s.marks, s.category, 
                                    s.application_date, array_agg(json_build_object('course_id', sp.course_id, 'priority', sp.priority) 
                                    ORDER BY sp.priority) AS preferences 
                                    FROm students s 
                                    LEFT JOIN student_preferences sp ON s.student_id = sp.student_id 
                                    GROUP BY s.student_id
                                    ORDER BY s.student_id`);
    return result.rows;                                    
}
module.exports = {registerStudent, listStudents};