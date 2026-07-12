const pool = require('../config/db');
/**
 * Core allocation algorithm.
 *
 * Business rules implemented:
 * 1. Students are processed in order of: higher marks first, then earlier application_date
 *    as tie-breaker (implements "higher marks = higher priority" + tie rule).
 * 2. For each student, we walk through their preferences in priority order (1, 2, 3...).
 * 3. For each preferred course, we first try to seat them against their OWN category's
 *    reserved quota. If that's full, we try the "General" pool (unreserved / open seats)
 *    IF the course still has capacity there.
 *    ASSUMPTION (documented, since no clarification contact was available): if a
 *    category's reserved seats aren't fully used and general seats run out, reserved
 *    seats do NOT get poached by general category students — reservation is protected.
 *    However, a reserved-category student MAY take a General seat if their own
 *    category's reservation is full but general seats remain (standard admission practice).
 * 4. A student can be allocated to only ONE course (first satisfied preference wins).
 * 5. If none of a student's preferences have room, they are marked REJECTED.
 *
 * This function is idempotent-safe: it resets allocations before recomputing.
 */

async function runAllocation(){
    const client  = await pool.connect();
    try{
        await client.query('BEGIN');

        // Reset previous allocation run
        await client.query(`DELETE FROM allocations`);
        await client.query(`UPDATE course_reservations SET filled_seats = 0`);

        // Fetch students ordered by business priority: marks desc, application date asc
        const studentResult = await client.query(`
            SELECT student_id, marks, category, application_date
            FROM students ORDER BY marks DESC, application_date ASC`);
        const students = studentResult.rows;

        //Fetch all prefrence grouped by student
        const prefsResult = await client.query(`SELECT student_id, course_id, priority FROM student_preferences ORDER BY student_id, priority`);
        const prefsByStudent = {};
        for(const p of prefsResult.rows){
            if(!prefsByStudent[p.student_id])  prefsByStudent[p.student_id] = [];
            prefsByStudent[p.student_id].push(p);
        }

        //Fetch course reservation state (mutable in-memory during this run)
        const reservationsResult = await client.query(
            `SELECT reservation_id, course_id, category, reserved_seats, filled_seats 
            FROM course_reservations`);

        //Index: reservation[course_id][category] = {reserved_seats, filled_seats}
        const reservations ={};
        for(const r of reservationsResult.rows){
            if(!reservations[r.course_id]) reservations[r.course_id] ={};
            reservations[r.course_id][r.category] ={
                reservation_id:r.reservation_id,
                reserved: r.reserved_seats,
                filled: r.filled_seats
            };
        }
        const results = [];

        for(const student of students){
            const preferences = prefsByStudent[student.student_id] ||[];
            let allocated = false;
            for(const pref of preferences){
                const courseReservations = reservations[pref.course_id];
                if(!courseReservations) continue;

                // Try own-category quota first
                const ownQuota = courseReservations[student.category];
                if(ownQuota && ownQuota.filled<ownQuota.reserved){
                    ownQuota.filled +=1;
                    results.push({
                        student_id:student.student_id,
                        course_id:pref.course_id,
                        allocated_priority:pref.priority,
                        status:'ALLOCATED',
                    });
                    allocated = true;
                    break;
                }

                // Fall back to General pool if student's own quota is full but General has room
                // (only applies to non-General students; General students already checked above)
                if(student.category !== 'General'){
                    const generalQuota = courseReservations['General'];
                    if(generalQuota && generalQuota.filled < generalQuota.reserved){
                         generalQuota.filled +=1;
                        results.push({
                            student_id:student.student_id,
                            course_id:pref.course_id,
                            allocated_priority:pref.priority,
                            status:'ALLOCATED',
                        });
                        allocated = true;
                        break;
                    }
                }
            }
        
            if(!allocated){
                results.push({
                    student_id:student.student_id,
                    course_id:null,
                    allocated_priority:null,
                    status:'REJECTED',
                    });
            }
        }

        //Presist allocation result
        for(const r of results)
        {
            await client.query(`INSERT INTO allocations(student_id, course_id,allocated_priority,status) 
                VALUES($1,$2,$3,$4)`,[r.student_id, r.course_id,r.allocated_priority,r.status]);
        }

        //Presist updated filled  seats count back to course_reservations
        for(const courseid of Object.keys(reservations))
        {
            for(const category of Object.keys(reservations[courseid]))
            {
                const q = reservations[courseid][category];
                await client.query(`UPDATE course_reservations SET filled_seats = $1 WHERE  reservation_id =$2`,[q.filled, q.reservation_id]);
            }
        }
        await client.query('COMMIT');

        const allocatedCount = results.filter((r)=>r.status === 'ALLOCATED').length;
        const rejectedCount = results.filter((r)=>r.status === 'REJECTED').length;

        return {totalStudents: students.length, allocatedCount,rejectedCount}
    }
    catch(err){
        await client.query('ROLLBACK');
        throw err;
    }
    finally{
        client.release();
    }
}


async function getAllocationResults(){
    const result = await pool.query(`SELECT a.allocation_id, s.student_id, s.name, s.marks, s.category, c.course_name, a.allocated_priority, a.status
        FROM allocations a
        JOIN students s ON a.student_id = s.student_id
        LEFT JOIN courses c ON a.course_id = c.course_id
        ORDER BY a.status, s.marks DESC`);
        return result.rows;
}

async function getDashboardStats(){
    const totalAllocated = await pool.query(`SELECT COUNT(*) FROM allocations WHERE status = 'ALLOCATED'`);
    const totalRejected = await pool.query(`SELECT COUNT(*) FROM allocations WHERE status = 'REJECTED'`);

    const seatAvailability = await pool.query(`SELECT c.course_id, c.course_name, c.total_seats, 
                                            SUM(cr.reserved_seats) as total_reserved, SUM(cr.filled_seats) as total_filled 
                                            FROM courses c join course_reservations cr ON cr.course_id = c.course_id
                                            GROUP BY c.course_id,c.course_name, c.total_seats
                                            ORDER BY c.course_name`);
    const categoryWise = await pool.query(`SELECT s.category, 
                                           COUNT(*) FILTER (WHERE a.status = 'ALLOCATED') as allocated ,
                                           COUNT(*) FILTER (WHERE a.status = 'REJECTED') as rejected FROM allocations a 
                                           JOIN students s ON s.student_id = a.student_id
                                           GROUP BY s.category
                                           ORDER BY s.category`);
    return {
        totalAllocated: parseInt(totalAllocated.rows[0].count,10),
        totalRejected: parseInt(totalRejected.rows[0].count,10),
        courseStats: seatAvailability.rows,
        categoryWise: categoryWise.rows,
    };
}


module.exports = {getAllocationResults, getDashboardStats, runAllocation};