import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export default function DatasetAssistant() {
  const [datasets, setDatasets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState([]);
  const [asking, setAsking] = useState(false);
  const fileInputRef = useRef();

  const loadDatasets = () => api.listDatasets().then((d) => setDatasets(d.datasets)).catch(() => {});

  useEffect(() => { loadDatasets(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const result = await api.uploadDataset(file);
      await loadDatasets();
      setSelectedId(result.dataset.datasetId);
      setChat([]);
      fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim() || !selectedId) return;
    const q = question;
    setChat((c) => [...c, { role: 'user', text: q }]);
    setQuestion('');
    setAsking(true);
    try {
      const result = await api.askDataset(selectedId, q);
      setChat((c) => [...c, { role: 'ai', result }]);
    } catch (err) {
      setChat((c) => [...c, { role: 'ai', error: err.message }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Upload Dataset (CSV / Excel)</h2>
        <form onSubmit={handleUpload}>
          <input type="file" ref={fileInputRef} accept=".csv,.xlsx,.xls" />
          {uploadError && <p className="error-text">{uploadError}</p>}
          <button className="primary" type="submit" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload & Create Table'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Your Datasets</h2>
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>File</th><th>Rows</th><th></th></tr></thead>
          <tbody>
            {datasets.map((d) => (
              <tr key={d.dataset_id} style={{ background: d.dataset_id === selectedId ? '#eaf2ff' : 'transparent' }}>
                <td>{d.dataset_id}</td><td>{d.dataset_name}</td><td>{d.original_filename}</td><td>{d.row_count}</td>
                <td>
                  <button className="secondary" onClick={() => { setSelectedId(d.dataset_id); setChat([]); }}>
                    {d.dataset_id === selectedId ? 'Selected' : 'Select'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>AI SQL Assistant {selectedId ? `— Dataset #${selectedId}` : '(select a dataset first)'}</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Try: "Show top 5 customers by revenue" or "Which month generated the highest sales?"
        </p>
        <div className="chat-box">
          {chat.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              {m.role === 'user' && m.text}
              {m.role === 'ai' && m.error && <span className="error-text">{m.error}</span>}
              {m.role === 'ai' && m.result && (
                <div>
                  <div className="sql-block">{m.result.sql}</div>
                  <table>
                    <thead><tr>{m.result.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {m.result.rows.map((row, ri) => (
                        <tr key={ri}>{m.result.columns.map((c) => <td key={c}>{String(row[c])}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleAsk} style={{ display: 'flex', gap: 8 }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={selectedId ? 'Ask a question about this dataset...' : 'Select a dataset first'}
            disabled={!selectedId}
          />
          <button className="primary" type="submit" disabled={asking || !selectedId}>{asking ? '...' : 'Ask'}</button>
        </form>
      </div>
    </div>
  );
}
