import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AllocationDashboard() {
  const [stats, setStats] = useState(null);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState([]);
  const [asking, setAsking] = useState(false);

  const loadData = async () => {
    try {
      const dashboard = await api.getDashboard();
      setStats(dashboard || null);
    } catch (err) {
      setStats(null);
    }

    try {
      const data = await api.getAllocationResults();
      setResults(Array.isArray(data?.results) ? data.results : []);
    } catch (err) {
      setResults([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProcess = async () => {
    setProcessing(true);
    setError('');
    try {
      await api.processAllocation();
      await loadData();
    } catch (err) {
      setError(err?.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    const q = question.trim();
    setChat((c) => [...c, { role: 'user', text: q }]);
    setQuestion('');
    setAsking(true);

    try {
      const result = await api.askAllocationAssistant(q);
      setChat((c) => [...c, { role: 'ai', result }]);
    } catch (err) {
      setChat((c) => [...c, { role: 'ai', error: err?.message || 'Ask failed' }]);
    } finally {
      setAsking(false);
    }
  };

  const courseStats = Array.isArray(stats?.courseStats) ? stats.courseStats : [];
  const categoryWise = Array.isArray(stats?.categoryWise) ? stats.categoryWise : [];

  return (
    <div>
      <div className="card">
        <h2>Allocation Processing</h2>
        <button className="primary" onClick={handleProcess} disabled={processing}>
          {processing ? 'Processing...' : 'Run Allocation'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>

      {stats && (
        <div className="card">
          <h2>Dashboard</h2>
          <div className="stat-grid">
            <div className="stat-box">
              <div className="num">{stats.totalAllocated ?? 0}</div>
              <div className="label">Allocated</div>
            </div>
            <div className="stat-box">
              <div className="num">{stats.totalRejected ?? 0}</div>
              <div className="label">Rejected</div>
            </div>
          </div>

          <h3 style={{ marginTop: 20, fontSize: 15 }}>Course-wise Seat Availability</h3>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Total Seats</th>
                <th>Reserved</th>
                <th>Filled</th>
              </tr>
            </thead>
            <tbody>
              {courseStats.length > 0 ? (
                courseStats.map((c) => (
                  <tr key={c.course_id}>
                    <td>{c.course_name ?? '-'}</td>
                    <td>{c.total_seats ?? 0}</td>
                    <td>{c.total_reserved ?? 0}</td>
                    <td>{c.total_filled ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">No course stats available.</td>
                </tr>
              )}
            </tbody>
          </table>

          <h3 style={{ marginTop: 20, fontSize: 15 }}>Category-wise Allocation</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Allocated</th>
                <th>Rejected</th>
              </tr>
            </thead>
            <tbody>
              {categoryWise.length > 0 ? (
                categoryWise.map((c) => (
                  <tr key={c.category}>
                    <td>{c.category ?? '-'}</td>
                    <td>{c.allocated ?? 0}</td>
                    <td>{c.rejected ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3">No category stats available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>Allocated Students</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Marks</th>
              <th>Category</th>
              <th>Course</th>
              <th>Pref #</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {results.length > 0 ? (
              results.map((r) => (
                <tr key={r.allocation_id}>
                  <td>{r.name ?? '-'}</td>
                  <td>{r.marks ?? '-'}</td>
                  <td>{r.category ?? '-'}</td>
                  <td>{r.course_name || '-'}</td>
                  <td>{r.allocated_priority ?? '-'}</td>
                  <td>
                    <span className={`badge ${(r.status || 'unknown').toLowerCase()}`}>
                      {r.status || '-'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">No allocation results available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>AI Assistant — Ask about allocations</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Try: "How many students were allocated to each course?" or "Which students did not receive their first preference?"
        </p>

        <div className="chat-box">
          {chat.map((m, i) => {
            const columns = Array.isArray(m?.result?.columns) ? m.result.columns : [];
            const rows = Array.isArray(m?.result?.rows) ? m.result.rows : [];

            return (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === 'user' && <div>{m.text}</div>}

                {m.role === 'ai' && m.error && <span className="error-text">{m.error}</span>}

                {m.role === 'ai' && m.result && (
                  <div>
                    <div className="sql-block">{m.result.sql ?? ''}</div>

                    <table>
                      <thead>
                        <tr>
                          {columns.map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length > 0 ? (
                          rows.map((row, ri) => (
                            <tr key={ri}>
                              {columns.map((c) => (
                                <td key={c}>{String(row?.[c] ?? '')}</td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={columns.length || 1}>No rows returned.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAsk} style={{ display: 'flex', gap: 8 }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
          />
          <button className="primary" type="submit" disabled={asking}>
            {asking ? '...' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  );
}
