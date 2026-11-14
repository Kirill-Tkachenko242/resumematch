import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import Nav from '../components/Nav';

export default function Applicants() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.applicants(id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <><Nav /><p style={{ color: 'crimson' }}>{error}</p></>;
  if (!data) return <><Nav /><p>Loading...</p></>;

  return (
    <>
      <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <Link to="/jobs">← Back to jobs</Link>
      <h2>Applicants: {data.job.title}</h2>
      {data.applicants.length === 0 && <p>No applications yet.</p>}
      {data.applicants.map((a, i) => (
        <div key={a.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 8 }}>
          <div onClick={() => setOpen(open === a.id ? null : a.id)} style={{ cursor: 'pointer' }}>
            <b>#{i + 1} {a.candidate_name}</b> - {a.resume_title} v{a.version_number} - <b>{Number(a.overall_score)}%</b>
            <div style={{ background: '#eee', height: 8 }}>
              <div style={{ width: `${a.overall_score}%`, background: '#4f46e5', height: 8 }} />
            </div>
          </div>
          {open === a.id && (
            <div style={{ marginTop: 8 }}>
              <p>
                Skills: {a.category_scores?.skills ?? '-'} · Experience: {a.category_scores?.experience ?? '-'} · Keywords: {a.category_scores?.keywords ?? '-'}
              </p>
              <p>Matched skills: {(a.explanation?.skills?.matched || []).join(', ') || '-'}</p>
              <p>Missing skills: {(a.explanation?.skills?.missing || []).join(', ') || '-'}</p>
            </div>
          )}
        </div>
      ))}
      </div>
    </>
  );
}