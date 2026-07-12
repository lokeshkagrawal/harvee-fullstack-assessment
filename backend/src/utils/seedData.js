/**
 * Seeds sample courses and students for demoing Task 1.
 * Run with: npm run seed
 */
require('dotenv').config();
const pool = require('../config/db');


async function seed(){
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Cleaning existing Task 1 Data...');
       await client.query(`DELETE FROM allocations`);
        await client.query(`DELETE FROM student_preferences`);
       await  client.query(`DELETE FROM students`);
       await  client.query(`DELETE FROM course_reservations`);
        await client.query(`DELETE FROM courses`);

        console.log('Inserting Course....');

        const courses = [
            {name:'Computer Science', total:10, reservations:{General: 5, OBC: 3, SC:1, ST:1,}},
            { name: 'Mechanical Engineering', total: 8, reservations: { General: 4, OBC: 2, SC: 1, ST: 1 } },
            { name: 'Electronics Engineering', total: 6, reservations: { General: 3, OBC: 2, SC: 1, ST: 0 } },
        ]

        const courseIds={};
        for(const c of courses){
            const res = await client.query(`INSERT INTO courses(course_name, total_seats) VALUES($1,$2) RETURNING course_id`, [c.name, c.total]);

            const courseId = res.rows[0].course_id;
            courseIds[c.name] = courseId;
            for(const [category, seats] of Object.entries(c.reservations)){
                await client.query(`INSERT INTO course_reservations(course_id, category, reserved_seats) VALUES($1,$2,$3)`,[courseId, category, seats]);


            }
        }
        console.log('Inserting Students....');

        const students = [
      { name: 'Aarav Sharma', marks: 92, category: 'General', prefs: ['Computer Science', 'Mechanical Engineering'] },
      { name: 'Priya Verma', marks: 88, category: 'OBC', prefs: ['Computer Science', 'Electronics Engineering'] },
      { name: 'Rohit Kumar', marks: 85, category: 'SC', prefs: ['Mechanical Engineering', 'Computer Science'] },
      { name: 'Sneha Patel', marks: 95, category: 'General', prefs: ['Computer Science'] },
      { name: 'Vikram Singh', marks: 78, category: 'ST', prefs: ['Electronics Engineering', 'Mechanical Engineering'] },
      { name: 'Anjali Gupta', marks: 90, category: 'General', prefs: ['Mechanical Engineering', 'Computer Science'] },
      { name: 'Karan Mehta', marks: 82, category: 'OBC', prefs: ['Computer Science', 'Mechanical Engineering', 'Electronics Engineering'] },
      { name: 'Neha Joshi', marks: 75, category: 'SC', prefs: ['Computer Science'] },
      { name: 'Arjun Reddy', marks: 89, category: 'General', prefs: ['Electronics Engineering', 'Computer Science'] },
      { name: 'Divya Nair', marks: 70, category: 'ST', prefs: ['Mechanical Engineering'] },
    ];

    for( const s of students){
        const res  = await client.query(`INSERT INTO students(name, marks, category) VALUES($1,$2,$3) RETURNING student_id`,[s.name, s.marks, s.category]);

        const student_id = res.rows[0].student_id;
        for(let i =0; i<s.prefs.length; i++){
            await client.query(`INSERT INTO student_preferences(student_id, course_id, priority) VALUES($1,$2,$3)`, [student_id, courseIds[s.prefs[i]], i+1]);

        }

    }

    await client.query('COMMIT');
    console.log('Seed complete! 3 courses, 10 students inserted.');
    console.log('Now call POST /api/allocation/process to run the allocation.');
    
    } catch (err) {
        
        await client.query(`ROLLBACK`);
        console.error('Seed failed:', err);
    }
    finally{
        client.release();
        process.exit();
    }
}

seed();
