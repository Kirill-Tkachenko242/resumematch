import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser, logout } from '../api';

export default function Resumes() {
  const navigate = useNavigate();
  const user = getUser();

  const [rows, setRows] = useState([]);
  const [file, setFile] = useState(null);
  const [resumeId, setResumeId] = useState(''); // '' = new resume
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function handleError(err) {
    if (err.message.includes('token')) {
      logout();
      navigate('/login');
      return;
    }
    setError(err.message);
  }

  async function load() {
    try {
      setRows(await api.listResumes());
    } catch (err) {
      handleError(err);
    }
  }

  useEffect(() => {
    let cancelled = false;
    api.listResumes()
        .then((data) => {
        if (!cancelled) setRows(data);
        })
        .catch((err) => {
        if (cancelled) return;
        if (err.message.includes('token')) {
            logout();
            navigate('/login');
        } else {
            setError(err.message);
        }
        });
    return () => { cancelled = true; };
    }, [navigate]);

  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      await api.uploadResume(file, resumeId || undefined);
      setFile(null);
      e.target.reset();
      await load();
    } catch (err) {
      handleError(err);
    } finally {
      setUploading(false);
    }
  }

  async function analyze(versionId) {
    setError('');
    setSelected(versionId);
    setResult(null);
    setAnalyzingId(versionId);
    try {
      setResult(await api.extract(versionId));
    } catch (err) {
      handleError(err);
    } finally {
      setAnalyzingId(null);
    }
  }

  // one entry per resume for the dropdown
  const resumes = [...new Map(rows.map((r) => [r.resume_id, r.title])).entries()];

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>My Resumes</h1>
        <div>
          {user?.name} ({user?.role}){' '}
          <button onClick={() => { logout(); navigate('/login'); }}>Log out</button>
        </div>
      </header>

      {user?.role !== 'candidate' && (
        <p style={{ color: 'crimson' }}>Only candidate accounts can upload resumes.</p>
      )}

      <form onSubmit={upload} style={{ display: 'grid', gap: 8, margin: '24px 0' }}>
        <h3>Upload a resume (PDF or DOCX, max 10 MB)</h3>
        <input type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files[0])} />
        <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
          <option value="">New resume</option>
          {resumes.map(([id, title]) => (
            <option key={id} value={id}>New version of: {title}</option>
          ))}
        </select>
        <button type="submit" disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <h3>Versions</h3>
      {rows.length === 0 && <p>No resumes uploaded yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {rows.map((r) => (
          <li key={r.version_id} style={{ border: '1px solid #ccc', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <strong>{r.title}</strong> - v{r.version_number} - {r.file_name}
              <br />
              <small>{new Date(r.created_at).toLocaleString()}</small>
            </span>
            <button onClick={() => analyze(r.version_id)} disabled={analyzingId === r.version_id}>
              {analyzingId === r.version_id ? 'Analyzing...' : 'Analyze'}
            </button>
          </li>
        ))}
      </ul>

      {result && (
        <section style={{ border: '1px solid #ccc', padding: 16, marginTop: 24 }}>
          <h3>Analysis of version #{selected}</h3>
          <p><em>{result.summary}</em></p>
          <p><strong>Experience:</strong> {result.years_of_experience} years</p>
          <p><strong>Job titles:</strong> {result.job_titles?.join(', ') || '-'}</p>
          <p><strong>Skills:</strong></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {result.skills?.map((s) => (
              <span key={s} style={{ background: '#eee', padding: '2px 8px', borderRadius: 12 }}>{s}</span>
            ))}
          </div>
          <p><strong>Education:</strong></p>
          <ul>
            {result.education?.map((e, i) => (
              <li key={i}>{e.degree} {e.field && `- ${e.field}`} {e.institution && `(${e.institution})`}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}