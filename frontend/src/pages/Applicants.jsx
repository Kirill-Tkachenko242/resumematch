import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

const show = (v) => (v === null || v === undefined ? '-' : `${Number(v)}%`);

export default function Applicants() {
  const { id } = useParams();
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(id || '');
  const [loaded, setLoaded] = useState({ id: null, data: null, error: '' });
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState('score_desc');
  const [open, setOpen] = useState(null);

  // the company's jobs for the dropdown; pick the first one when no job is in the URL
  useEffect(() => {
    let cancelled = false;
    api.myJobs()
      .then((d) => {
        if (cancelled) return;
        setJobs(d);
        setJobId((cur) => cur || (d[0] ? String(d[0].id) : ''));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // applicants of the selected job
  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    api.applicants(jobId)
      .then((d) => { if (!cancelled) setLoaded({ id: jobId, data: d, error: '' }); })
      .catch((e) => { if (!cancelled) setLoaded({ id: jobId, data: null, error: e.message }); });
    return () => { cancelled = true; };
  }, [jobId]);

  const current = loaded.id === jobId ? loaded : { data: null, error: '' };
  const all = current.data ? current.data.applicants : [];

  const rows = all
    .filter((a) => Number(a.overall_score) >= minScore)
    .sort((a, b) => {
      if (sort === 'score_asc') return Number(a.overall_score) - Number(b.overall_score);
      if (sort === 'name') return a.candidate_name.localeCompare(b.candidate_name);
      return Number(b.overall_score) - Number(a.overall_score);
    });

  return (
    <div className="page">
      <h1 className="page-title">Applicant ranking</h1>
      <p className="lead">Compare candidates for a selected job using their match scores.</p>

      <div className="panel grey filters">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="job">Selected job</label>
          <select id="job" value={jobId} onChange={(e) => { setJobId(e.target.value); setOpen(null); }}>
            {jobs.length === 0 && <option value="">No jobs yet</option>}
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="min">Minimum match score</label>
          <select id="min" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
            <option value={0}>All scores</option>
            <option value={50}>50% and above</option>
            <option value={70}>70% and above</option>
            <option value={80}>80% and above</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="score_desc">Overall score: highest first</option>
            <option value="score_asc">Overall score: lowest first</option>
            <option value="name">Candidate name</option>
          </select>
        </div>
      </div>

      {current.error && <p className="error">{current.error}</p>}

      <p className="muted" style={{ margin: '32px 0 12px' }}>
        <strong style={{ color: 'var(--text)' }}>{rows.length} candidate{rows.length === 1 ? '' : 's'}</strong>
        {' '}• sorted by {sort === 'name' ? 'name' : 'overall match score'}
      </p>

      {rows.length === 0 ? (
        <p className="muted">{jobId ? 'No applications match the filters.' : 'Post a job first.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Candidate name</th>
                <th>Overall score</th>
                <th>Category score badges</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const d = a.explanation || {};
                return (
                  <Fragment key={a.id}>
                    <tr>
                      <td>
                        <strong>{a.candidate_name}</strong>
                        <div className="sub">{a.resume_title} v{a.version_number}</div>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div className="score-big">{Number(a.overall_score)}%</div>
                        <div className="bar"><span style={{ width: `${Number(a.overall_score)}%` }} /></div>
                      </td>
                      <td>
                        <span className="badge">Skills {show(a.category_scores?.skills)}</span>
                        <span className="badge">Experience {show(a.category_scores?.experience)}</span>
                        <span className="badge">Keywords {show(a.category_scores?.keywords)}</span>
                      </td>
                      <td>
                        <button className="btn small" onClick={() => setOpen(open === a.id ? null : a.id)}>
                          {open === a.id ? 'Hide details' : 'View details'}
                        </button>
                      </td>
                    </tr>
                    {open === a.id && (
                      <tr>
                        <td colSpan={4} style={{ background: 'var(--panel)' }}>
                          <p style={{ margin: '0 0 8px' }}>
                            <strong>Matched skills:</strong> {(d.skills?.matched || []).join(', ') || '-'}
                          </p>
                          <p style={{ margin: '0 0 8px' }}>
                            <strong>Missing skills:</strong> {(d.skills?.missing || []).join(', ') || '-'}
                          </p>
                          <p style={{ margin: 0 }}>
                            <strong>Experience:</strong> {d.experience?.years_have ?? '-'} years
                            (required {d.experience?.years_needed ?? 0}+)
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="footnote">Match scores inform review; they are not hiring decisions.</div>
    </div>
  );
}
