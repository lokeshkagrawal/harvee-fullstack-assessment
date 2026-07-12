import { useState, useEffect } from 'react';
import { api } from '../services/api';

const CATEGORIES = ['General', 'OBC', 'SC', 'ST'];

export default function CourseManagement() {
  const [courses, setCourses] = useState([]);
  const [courseName, setCourseName] = useState('');
  const [totalSeats, setTotalSeats] = useState('');
  const [reservations, setReservations] = useState({ General: '', OBC: '', SC: '', ST: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCourses = () => api.listCourses().then((d) => setCourses(d.courses)).catch((e) => setError(e.message));

  useEffect(() => { loadCourses(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const reservationPayload = Object.entries(reservations)
        .filter(([, v]) => v !== '')
        .map(([category, seats]) => ({ category, seats: Number(seats) }));
      await api.createCourse({ courseName, totalSeats: Number(totalSeats), reservations: reservationPayload });
      setCourseName('');
      setTotalSeats('');
      setReservations({ General: '', OBC: '', SC: '', ST: '' });
      loadCourses();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Add Course</h2>
        <form onSubmit={handleSubmit}>
          <label>Course Name</label>
          <input value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
          <label>Total Seats</label>
          <input type="number" value={totalSeats} onChange={(e) => setTotalSeats(e.target.value)} required />
          <label>Reserved Seats by Category (leave blank if none)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {CATEGORIES.map((cat) => (
              <div key={cat} style={{ flex: 1 }}>
                <label style={{ fontWeight: 400 }}>{cat}</label>
                <input
                  type="number"
                  value={reservations[cat]}
                  onChange={(e) => setReservations({ ...reservations, [cat]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Adding...' : 'Add Course'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Courses ({courses.length})</h2>
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Total Seats</th><th>Reservations</th></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.course_id}>
                <td>{c.course_id}</td>
                <td>{c.course_name}</td>
                <td>{c.total_seats}</td>
                <td>
                  {c.reservations.filter(r => r.category).map((r) => (
                    <span key={r.category} style={{ marginRight: 8 }}>
                      {r.category}: {r.filled}/{r.reserved}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
