import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ScoreChart from '../components/ScoreChart';

const CATEGORIES = [
  ['skills', 'Skills Match'],
  ['experience', 'Experience Relevance'],
  ['keywords', 'Keyword Alignment'],
];

const pct = (v) => (v === null || v === undefined ? 'n/a' : `${Number(v)}%`);
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// plain facts, shown when the AI explanation is not available
function fallbackText(key, d) {
  if (!d) return '';
  if (key === 'skills' && d.skills) {
    const total = d.skills.matched.length + d.skills.missing.length;
    return total ? `${d.skills.matched.length} of ${total} required skills found in your resume.` : '';
  }
  if (key === 'experience' && d.experience && d.experience.score !== null) {
    return `Your resume shows ${d.experience.years_have} years; the job asks for ${d.experience.years_needed}+.`;
  }
  if (key === 'keywords' && d.keywords && d.keywords.score !== null) {
    const total = d.keywords.found.length + d.keywords.missing.length;
    return `${d.keywords.found.length} of ${total} job keywords appear in your resume.`;
  }
  return 'Not enough information in the job description for this category.';
}

export default function Match() {
  const [params] = useSearchParams();
  const init = useLocation().state; // filled when coming from "Upload & analyze"

  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [versionId, setVersionId] = useState(init?.versionId ? String(init.versionId) : '');
  const [jobId, setJobId] = useState(init?.jobId ? String(init.jobId) : params.get('job') || '');
  const [result, setResult] = useState(init?.result || null);
  const [snap, setSnap] = useState(
    init?.result
      ? { versionId: String(init.versionId), jobId: init.jobId ? String(init.jobId) : '', pasted: Boolean(init.pasted), at: init.analyzedAt }
      : null
  );
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listResumes(), api.listJobs()])
      .then(async ([r, j]) => {
        if (cancelled) return;
        setRows(r);
        setJobs(j);
        if (!init?.versionId && r.length) setVersionId(String(Math.max(...r.map((x) => x.version_id))));
        // score history for a result that was computed on the previous page
        if (init?.result && init.jobId) {
          const row = r.find((x) => String(x.version_id) === String(init.versionId));
          if (row) {
            const h = await api.history(row.resume_id, init.jobId);
            if (!cancelled) setHistory(h);
          }
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [init]);

  async function analyze() {
    setError('');
    setApplied('');
    setLoading(true);
    setResult(null);
    setHistory([]);
    try {
      const res = await api.score({ resume_version_id: Number(versionId), job_id: Number(jobId) });
      setResult(res);
      setSnap({ versionId, jobId, pasted: false, at: new Date().toISOString() });
      const row = rows.find((r) => String(r.version_id) === versionId);
      setHistory(await api.history(row.resume_id, jobId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    try {
      await api.apply(snap.versionId, snap.jobId);
      setApplied('Application sent. Applying again replaces your previous application for this job.');
    } catch (e) {
      setApplied(e.message);
    }
  }

  // what the shown result was computed for
  const snapRow = snap ? rows.find((r) => String(r.version_id) === snap.versionId) : null;
  const snapJob = snap && snap.jobId ? jobs.find((j) => String(j.id) === snap.jobId) : null;
  const jobLabel = snap?.pasted
    ? 'Pasted job description'
    : snapJob ? `${snapJob.title}${snapJob.company_name ? ` • ${snapJob.company_name}` : ''}` : '';
  const meta = [jobLabel, snapRow?.file_name, snap?.at ? `Analyzed ${fmtDate(snap.at)}` : ''].filter(Boolean).join(' • ');

  const d = result?.details;
  const ai = result?.ai_explanation;

  const last = history.length ? history[history.length - 1] : null;
  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const delta = last && prev ? Math.round((Number(last.overall_score) - Number(prev.overall_score)) * 10) / 10 : null;
  let deltaText = 'First analysis for this job. Review the suggestions below.';
  if (delta !== null) {
    const from = `the previous analysis (version ${prev.version_number})`;
    if (delta > 0) deltaText = `Up ${delta} percentage points from ${from}. Review the suggestions below.`;
    else if (delta < 0) deltaText = `Down ${Math.abs(delta)} percentage points from ${from}. Review the suggestions below.`;
    else deltaText = `No change from ${from}. Review the suggestions below.`;
  }

  // concrete suggestions come from the calculated data; the AI adds one general tip
  const suggestions = [];
  if (d?.skills?.missing?.length) {
    suggestions.push(['Skills', 'Show the missing skills', `Missing: ${d.skills.missing.join(', ')}. Add them only if they reflect your real experience.`]);
  }
  if (d?.experience && d.experience.years_needed > d.experience.years_have) {
    suggestions.push(['Experience', 'Close the experience gap', `The job asks for ${d.experience.years_needed}+ years and your resume shows ${d.experience.years_have}. Describe internships and projects with measurable outcomes.`]);
  } else if (d?.experience?.education_match === false) {
    suggestions.push(['Experience', 'Check the education requirement', 'Your degree is not in the list accepted for this role. Mention relevant courses or certifications.']);
  }
  if (d?.keywords?.missing?.length) {
    suggestions.push(['Keywords', 'Use relevant job terminology', `Consider mentioning: ${d.keywords.missing.join(', ')} where it is accurate.`]);
  }
  if (ai?.tip) suggestions.push(['Next step', 'Suggested by the AI assistant', ai.tip]);

  return (
    <div className="page">
      <h1 className="page-title">Match score breakdown</h1>
      <p className="lead" style={{ marginBottom: result ? 32 : 24 }}>
        {result ? meta : 'Choose a resume version and a job to see how well they match.'}
      </p>

      <div className="panel grey filters" style={{ gridTemplateColumns: '1fr 1fr auto', alignItems: 'end', marginBottom: 32 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="version">Resume version</label>
          <select id="version" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
            <option value="">Select resume version</option>
            {rows.map((r) => (
              <option key={r.version_id} value={r.version_id}>{r.title} - v{r.version_number}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="job">Job</label>
          <select id="job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">Select job</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}{j.company_name ? ` - ${j.company_name}` : ''}</option>
            ))}
          </select>
        </div>
        <button className="btn primary" onClick={analyze} disabled={!versionId || !jobId || loading}>
          {loading ? 'Analysing...' : 'Analyze'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <div className="overall">
            <div className="num">{pct(result.overall)}</div>
            <div className="grow">
              <h2>Overall match score</h2>
              <p className="muted" style={{ margin: '6px 0 0' }}>{deltaText}</p>
            </div>
            <div className="row">
              <Link className="btn" to="/resumes">Upload revised resume</Link>
              {snap?.jobId && <button className="btn primary" onClick={handleApply}>Apply with this version</button>}
            </div>
          </div>
          {applied && <p style={{ marginTop: 12 }}>{applied}</p>}

          <div className="cards" style={{ marginTop: 24 }}>
            {CATEGORIES.map(([key, label]) => (
              <div className="cat-card" key={key}>
                <div className="cat-head"><span>{label}</span><span className="pct">{pct(result.categories[key])}</span></div>
                <div className="bar" style={{ marginBottom: 12 }}><span style={{ width: `${result.categories[key] || 0}%` }} /></div>
                <div className="muted">{ai?.[key] || fallbackText(key, d)}</div>
              </div>
            ))}
          </div>

          {d?.skills && (
            <div className="panel" style={{ marginTop: 24 }}>
              <p style={{ margin: '0 0 8px' }}>
                <strong>Matched skills:</strong>{' '}
                {d.skills.matched.length ? d.skills.matched.map((s) => <span key={s} className="badge">{s}</span>) : '-'}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Missing skills:</strong>{' '}
                {d.skills.missing.length ? d.skills.missing.map((s) => <span key={s} className="badge">{s}</span>) : '-'}
              </p>
            </div>
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="panel" style={{ marginTop: 24 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 22 }}>Score history</h3>
            <span className="muted">Same job • Overall match (%)</span>
          </div>
          <ScoreChart history={history} />
        </div>
      )}

      {result && (
        <>
          <h2 className="section-title">Specific improvement suggestions</h2>
          {suggestions.length === 0 ? (
            <p className="muted">No specific suggestions: this resume covers the requirements of the job.</p>
          ) : (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              {suggestions.map(([area, what, text]) => (
                <div className="suggest" key={`${area}-${what}`}>
                  <div className="area">{area}</div>
                  <div><div className="what">{what}</div><div className="muted">{text}</div></div>
                </div>
              ))}
            </div>
          )}
          <div className="footnote">
            AI text supports, not replaces, human judgment. The scores come from a deterministic algorithm.
          </div>
        </>
      )}
    </div>
  );
}
