import { useState, useEffect } from 'react';
import { api } from '../services/api';

const CATEGORIES = ['General', 'OBC', 'SC', 'ST'];

export default function StudentRegistration() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [name, setName] = useState('');
  const [marks, setMarks] = useState('');
  const [category, setCategory] = useState('General');
  const [preferences, setPreferences] = useState(['', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    api.listStudents().then((d) => setStudents(d.students)).catch((e) => setError(e.message));
    api.listCourses().then((d) => setCourses(d.courses)).catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const prefIds = preferences.filter((p) => p !== '').map(Number);
      await api.registerStudent({ name, marks: Number(marks), category, preferences: prefIds });
      loadData();
      setName('');
      setMarks('');
      setPreferences(['', '', '']);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Register Student</h2>
        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Marks</label>
          <input type="number" step="0.01" value={marks} onChange={(e) => setMarks(e.target.value)} required />
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label>Course Preferences (in priority order)</label>
          {preferences.map((p, i) => (
            <div className="pref-row" key={i}>
              <span>#{i + 1}</span>
              <select
                value={p}
                onChange={(e) => {
                  const copy = [...preferences];
                  copy[i] = e.target.value;
                  setPreferences(copy);
                }}
              >
                <option value="">-- Select Course --</option>
                {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
              </select>
            </div>
          ))}
          {error && <p className="error-text">{error}</p>}
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register Student'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Registered Students ({students.length})</h2>
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Marks</th><th>Category</th></tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.student_id}>
                <td>{s.student_id}</td>
                <td>{s.name}</td>
                <td>{s.marks}</td>
                <td>{s.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

