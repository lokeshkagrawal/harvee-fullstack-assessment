const pool = require('../config/db');

async function createCourse({courseName, totalSeats, reservations}){
    if(!courseName || !totalSeats || !Array.isArray(reservations)){
        const err = new Error('courseName, totalSeats, reservation[] are required');
        err.isValidationError = true;
        throw err;
    }

    const reservedSum = reservations.reduce((sum,r)=> sum+Number(r.seats),0);
    if(reservedSum>totalSeats){
        const err = new Error('Sum of reserved seats cannot exceed total seats');
        err.isValidationError = true;
        throw err;
    }

    const client = await pool.connect();
try {
    
    await client.query('BEGIN');

    const courseResult =await client.query(`INSERT INTO courses(course_name, total_seats)  VALUES($1,$2) RETURNING course_id`,[courseName,totalSeats]);

    const courseId = courseResult.rows[0].course_id;

    for(const r of reservations){
        await client.query(`INSERT INTO course_reservations(course_id, category, reserved_seats) 
                            VALUES($1,$2,$3)`, [courseId, r.category, r.seats]);   
    }

    // Any remaining unreserved seats implicitly go to General if not already specified
    const hasGeneral = reservations.some((r)=>r.category === 'General');
    const remaining = totalSeats - reservedSum;
    if(!hasGeneral && remaining>0)
    {
        await client.query(`INSERT INTO course_reservations(course_id, category, reserved_seats) VALUES($1,'General',$2)`,[courseId, remaining]);

    }
    await client.query('COMMIT');
    return { courseId };
} catch (error) {
    await client.query("ROLLBACK");
    throw error;
}
finally{
    await client.release();
}
}

async function listCourses(){
    const result = await pool.query(`SELECT c.course_id, c.course_name,c.total_seats, 
                                json_agg(json_build_object('category',cr.category, 'reserved', cr.reserved_seats, 'filled', cr.filled_seats)) as reservations 
                                FROM courses c 
                                LEFT JOIN course_reservations cr on c.course_id = cr.course_id
                                GROUP BY c.course_id
                                ORDER By c.course_id`);
    return result.rows;
}

module.exports = {createCourse, listCourses};