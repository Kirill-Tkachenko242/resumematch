import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';

const CATEGORIES = [
  ['skills', 'Skills match'],
  ['experience', 'Experience relevance'],
  ['keywords', 'Keyword alignment'],
];

function Bar({ label, value }) {
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <strong>{value === null ? 'n/a' : `${value}%`}</strong>
      </div>
      <div style={{ background: '#eee', height: 8, borderRadius: 4 }}>
        <div style={{ width: `${value || 0}%`, background: '#333', height: 8, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export default function Match() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [versionId, setVersionId] = useState('');
  const [jobId, setJobId] = useState(params.get('job') || '');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listResumes(), api.listJobs()])
      .then(([r, j]) => {
        if (cancelled) return;
        setRows(r);
        setJobs(j);
        if (r.length) setVersionId(String(Math.max(...r.map((x) => x.version_id))));
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  async function analyze() {
    setError('');
    setLoading(true);
    setResult(null);
    setHistory([]);
    try {
      const res = await api.score({ resume_version_id: Number(versionId), job_id: Number(jobId) });
      setResult(res);
      const row = rows.find((r) => String(r.version_id) === versionId);
      setHistory(await api.history(row.resume_id, jobId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const skills = result?.details?.skills;

  async function handleApply() {
    try {
        await api.apply(versionId, jobId);   // your selected ids
        setApplied('Application sent. Re-applying replaces your previous one.');
    } catch (e) {
        setApplied(e.message);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <h1>Match score</h1>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
          <option value="">Select resume version</option>
          {rows.map((r) => (
            <option key={r.version_id} value={r.version_id}>{r.title} - v{r.version_number}</option>
          ))}
        </select>
        <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">Select job</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title} - {j.company_name}</option>
          ))}
        </select>
        <button onClick={analyze} disabled={!versionId || !jobId || loading}>
          {loading ? 'Analysing...' : 'Analyze'}
        </button>
      </div>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {result && (
        <section style={{ border: '1px solid #ccc', padding: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 700 }}>{result.overall}%</div>
          <p>Overall match score</p>

          {CATEGORIES.map(([key, label]) => (
            <Bar key={key} label={label} value={result.categories[key]} />
          ))}

          {skills && (
            <>
              <p><strong>Matched skills:</strong> {skills.matched.join(', ') || '-'}</p>
              <p><strong>Missing skills:</strong> {skills.missing.join(', ') || '-'}</p>
            </>
          )}
        </section>
      )}
      {result && jobId && (
        <>
            <button onClick={handleApply}>Apply with this version</button>
            {applied && <p>{applied}</p>}
        </>
      )}

      {history.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3>Score history for this job</h3>
          {history.map((h) => (
            <Bar key={h.id} label={`v${h.version_number} - ${new Date(h.created_at).toLocaleDateString()}`}
              value={Number(h.overall_score)} />
          ))}
        </section>
      )}
    </div>
  );
}