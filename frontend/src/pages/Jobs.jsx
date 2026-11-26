import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getUser } from '../api';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const EMPTY = { title: '', category_id: '', description: '' };

export default function Jobs() {
  const isCompany = getUser()?.role === 'company';
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (isCompany ? api.myJobs() : api.listJobs())
      .then((d) => { if (!cancelled) setJobs(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [isCompany, refresh]);

  useEffect(() => {
    if (!isCompany) return undefined;
    let cancelled = false;
    api.categories()
      .then((d) => { if (!cancelled) setCategories(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isCompany]);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function post(e) {
    e.preventDefault();
    setError('');
    setPosting(true);
    try {
      if (editingId) await api.updateJob(editingId, { ...form, category_id: form.category_id || null });
      else await api.postJob({ ...form, category_id: form.category_id || undefined });
      setForm(EMPTY);
      setEditingId(null);
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  function startEdit(j) {
    setEditingId(j.id);
    setForm({ title: j.title, category_id: j.category_id ?? '', description: j.description ?? '' });
    window.scrollTo(0, 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function toggleStatus(j) {
    try {
      await api.setJobStatus(j.id, j.status === 'closed' ? 'active' : 'closed');
      setRefresh((n) => n + 1);
    } catch (err) { setError(err.message); }
  }

  async function remove(j) {
    if (!window.confirm(`Delete "${j.title}" and all its applications?`)) return;
    try {
      await api.deleteJob(j.id);
      setRefresh((n) => n + 1);
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="page">
      <h1 className="page-title">
        {isCompany ? (editingId ? 'Edit job posting' : 'Create a job posting') : 'Browse jobs'}
      </h1>
      <p className="lead">
        {isCompany
          ? 'Define the role and requirements used to match candidate resumes.'
          : 'Open positions. Check how your resume matches before you apply.'}
      </p>

      {isCompany && (
        <form className="panel" onSubmit={post}>
          <div className="field">
            <label htmlFor="title">Job title</label>
            <input id="title" type="text" name="title" value={form.title} onChange={update} required />
          </div>
          <div className="field">
            <label htmlFor="category">Job category</label>
            <select id="category" name="category_id" value={form.category_id} onChange={update}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="description">Job description</label>
            <textarea id="description" name="description" rows={7} value={form.description} onChange={update}
              placeholder="Describe the role, required skills, experience and education. Requirements are extracted automatically."
              required />
          </div>
          <div className="row">
            <button className="btn primary" type="submit" disabled={posting}>
              {posting ? 'Analysing description...' : editingId ? 'Save changes' : 'Post job'}
            </button>
            {editingId && <button className="btn" type="button" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <h2 className="section-title">
        {isCompany ? `Your job postings (${jobs.length})` : `Open jobs (${jobs.length})`}
      </h2>

      {jobs.length === 0 ? (
        <p className="muted">No jobs yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Job title</th>
                <th>Required skills</th>
                <th>Experience</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const req = j.structured_requirements || {};
                const meta = [
                  isCompany ? (j.status === 'closed' ? 'Closed' : 'Active') : j.company_name,
                  j.category,
                  j.created_at ? `Posted ${fmtDate(j.created_at)}` : '',
                ].filter(Boolean).join(' • ');
                return (
                  <tr key={j.id}>
                    <td>
                      <strong>{j.title}</strong>
                      <div className="sub">{meta}</div>
                      {req.summary && <div className="sub"><em>{req.summary}</em></div>}
                    </td>
                    <td>
                      {(req.required_skills || []).map((s) => <span key={s} className="badge">{s}</span>)}
                    </td>
                    <td>{req.min_years_experience ?? 0}+ years</td>
                    <td>
                      <div className="actions">
                        {isCompany ? (
                          <>
                            <Link className="btn small" to={`/jobs/${j.id}/applicants`}>View applicants</Link>
                            <button className="btn small" onClick={() => startEdit(j)}>Edit</button>
                            <button className="btn small" onClick={() => toggleStatus(j)}>
                              {j.status === 'closed' ? 'Reopen' : 'Close'}
                            </button>
                            <button className="btn small danger" onClick={() => remove(j)}>Delete</button>
                          </>
                        ) : (
                          <Link className="btn small" to={`/match?job=${j.id}`}>Check my match</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="footnote">
        Match scores inform review; they are not hiring decisions.
      </div>
    </div>
  );
}
