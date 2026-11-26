import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser, logout } from '../api';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const newestId = (list) => (list.length ? Math.max(...list.map((x) => x.version_id)) : null);

export default function Resumes() {
  const navigate = useNavigate();
  const user = getUser();
  const fileInput = useRef(null);

  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [resumeId, setResumeId] = useState(''); // '' = new resume
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [jobId, setJobId] = useState('');
  const [jobText, setJobText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [extractingId, setExtractingId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileFor, setProfileFor] = useState(null);
  const [error, setError] = useState('');

  function handleError(err) {
    if (err.message.includes('token')) {
      logout();
      navigate('/login');
      return;
    }
    setError(err.message);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listResumes(), api.listJobs()])
      .then(([r, j]) => {
        if (cancelled) return;
        setRows(r);
        setJobs(j);
        setSelected((cur) => cur ?? newestId(r));
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

  // reload the list; keep the selection if it still exists, otherwise pick the newest version
  async function reload(forceNewest = false) {
    const r = await api.listResumes();
    setRows(r);
    setSelected((cur) => (!forceNewest && r.some((x) => x.version_id === cur) ? cur : newestId(r)));
  }

  function chooseFile(f) {
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      setError('Only PDF or DOCX files are supported.');
      return;
    }
    setError('');
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      await api.uploadResume(file, resumeId || undefined);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setProfile(null);
      await reload(true);
    } catch (err) {
      handleError(err);
    } finally {
      setUploading(false);
    }
  }

  async function analyze() {
    setError('');
    setAnalyzing(true);
    try {
      const text = jobText.trim();
      const body = { resume_version_id: Number(selected) };
      if (text) body.job_text = text;
      else body.job_id = Number(jobId);
      const result = await api.score(body);
      navigate('/match', {
        state: {
          result,
          versionId: selected,
          jobId: text ? null : jobId,
          pasted: Boolean(text),
          analyzedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      handleError(err);
    } finally {
      setAnalyzing(false);
    }
  }

  async function showProfile(r) {
    setError('');
    setExtractingId(r.version_id);
    try {
      setProfile(await api.extract(r.version_id));
      setProfileFor(r);
    } catch (err) {
      handleError(err);
    } finally {
      setExtractingId(null);
    }
  }

  async function removeVersion(r) {
    if (!window.confirm(`Delete ${r.title} v${r.version_number}?`)) return;
    setError('');
    try {
      await api.deleteVersion(r.version_id);
      if (profileFor?.version_id === r.version_id) setProfile(null);
      await reload();
    } catch (err) {
      handleError(err);
    }
  }

  async function removeResume(r) {
    if (!window.confirm(`Delete "${r.title}" with all its versions?`)) return;
    setError('');
    try {
      await api.deleteResume(r.resume_id);
      setProfile(null);
      if (resumeId === String(r.resume_id)) setResumeId('');
      await reload();
    } catch (err) {
      handleError(err);
    }
  }

  // one entry per resume for the dropdown, and the latest version number of each resume
  const resumes = [...new Map(rows.map((r) => [r.resume_id, r.title])).entries()];
  const latest = {};
  rows.forEach((r) => { latest[r.resume_id] = Math.max(latest[r.resume_id] || 0, r.version_number); });

  const canAnalyze = selected && (jobText.trim() || jobId) && !analyzing;

  return (
    <div className="page">
      <h1 className="page-title">Upload &amp; analyze your resume</h1>
      <p className="lead">Compare your resume with a job description to identify relevant skills and gaps.</p>

      {user?.role !== 'candidate' && (
        <p className="error">Only candidate accounts can upload resumes.</p>
      )}

      <div className="layout-side">
        {/* left: versions */}
        <aside className="versions">
          <h2 style={{ fontSize: 24 }}>My resume versions</h2>
          <p className="muted" style={{ margin: '12px 0 20px' }}>
            {rows.length} file{rows.length === 1 ? '' : 's'} uploaded
          </p>
          {rows.length === 0 && <p className="muted">No resumes uploaded yet.</p>}
          {rows.map((r) => (
            <div
              key={r.version_id}
              className={`version${selected === r.version_id ? ' selected' : ''}`}
              onClick={() => setSelected(r.version_id)}
            >
              <div className="name">{r.file_name || r.title}</div>
              <div className="meta">{fmtDate(r.created_at)}</div>
              <div className="meta">
                {r.title} • v{r.version_number}{latest[r.resume_id] === r.version_number ? ' • Latest version' : ''}
              </div>
              <div className="links" onClick={(e) => e.stopPropagation()}>
                <button className="linkbtn" onClick={() => showProfile(r)} disabled={extractingId === r.version_id}>
                  {extractingId === r.version_id ? 'Extracting...' : 'View extracted data →'}
                </button>
                <button className="linkbtn danger" onClick={() => removeVersion(r)}>Delete version</button>
                <button className="linkbtn danger" onClick={() => removeResume(r)}>Delete resume</button>
              </div>
            </div>
          ))}
        </aside>

        {/* right: upload and analyze */}
        <section>
          <div className="field">
            <span className="label">Resume file</span>
            <div
              className={`dropzone${dragging ? ' drag' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]); }}
            >
              <div className="arrow">↑</div>
              <div className="title">{file ? file.name : 'Drag and drop your resume here'}</div>
              <p className="hint">PDF or DOCX • Maximum file size 10 MB</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.docx"
                  hidden
                  onChange={(e) => chooseFile(e.target.files[0])}
                />
                <button className="btn" type="button" onClick={() => fileInput.current?.click()}>Browse files</button>
                {file && (
                  <button className="btn primary" type="button" onClick={upload} disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="saveas">Save the uploaded file as</label>
            <select id="saveas" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              <option value="">New resume</option>
              {resumes.map(([id, title]) => (
                <option key={id} value={id}>New version of: {title}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="job">Select a job</label>
            <select id="job" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Choose a job...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}{j.company_name ? ` — ${j.company_name}` : ''}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="jobtext">Or paste a job description</label>
            <textarea
              id="jobtext"
              rows={7}
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              placeholder="Paste the job description here, including required skills, responsibilities and experience..."
            />
          </div>

          <div className="row">
            <button className="btn primary" onClick={analyze} disabled={!canAnalyze}>
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </button>
            <span className="muted">
              {jobText.trim()
                ? 'The pasted description will be used instead of the selected job.'
                : 'Choose a resume version on the left, then choose or paste a job description.'}
            </span>
          </div>

          {error && <p className="error">{error}</p>}

          {profile && (
            <div className="panel" style={{ marginTop: 32 }}>
              <h3 style={{ marginBottom: 12 }}>
                Extracted data: {profileFor ? `${profileFor.title} - v${profileFor.version_number}` : ''}
              </h3>
              {profile.summary && <p><em>{profile.summary}</em></p>}
              <p><strong>Experience:</strong> {profile.years_of_experience} years</p>
              <p><strong>Job titles:</strong> {profile.job_titles?.join(', ') || '-'}</p>
              <p><strong>Skills:</strong></p>
              <div>{profile.skills?.map((s) => <span key={s} className="badge">{s}</span>)}</div>
              <p><strong>Education:</strong></p>
              <ul>
                {profile.education?.map((e, i) => (
                  <li key={i}>{e.degree} {e.field && `- ${e.field}`} {e.institution && `(${e.institution})`}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
