import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getUser } from '../api';

export default function Jobs() {
  const isCompany = getUser()?.role === 'company';
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', category_id: '', description: '' });
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (isCompany ? api.myJobs() : api.listJobs())
      .then((d) => { if (!cancelled) setJobs(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [isCompany, refresh]);

  useEffect(() => {
    if (!isCompany) return;
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
      const data = {
        ...form,
        category_id: form.category_id || null,
      };

      if (editingId) {
        await api.updateJob(editingId, data);
      } else {
        await api.postJob({
          ...form,
          category_id: form.category_id || undefined,
        });
      }

      setForm({ title: '', category_id: '', description: '' });
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
    setForm({
      title: j.title,
      category_id: j.category_id ?? '',
      description: j.description ?? '',
    });
    window.scrollTo(0, 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ title: '', category_id: '', description: '' });
  }

  async function toggleStatus(j) {
    try {
      await api.setJobStatus(
        j.id,
        j.status === 'closed' ? 'active' : 'closed'
      );
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(j) {
    if (!window.confirm(`Delete "${j.title}" and all its applications?`)) {
      return;
    }

    try {
      await api.deleteJob(j.id);
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err.message);
    }
  }


  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <h1>{isCompany ? 'My job postings' : 'Open jobs'}</h1>

      {isCompany && (
        <form onSubmit={post} style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
          <h3>{editingId ? 'Edit job' : 'Post a job'}</h3>
          <input name="title" placeholder="Job title" value={form.title} onChange={update} required />
          <select name="category_id" value={form.category_id} onChange={update}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <textarea name="description" rows={8} placeholder="Job description (skills, experience, education...)"
            value={form.description} onChange={update} required />
          <button type="submit" disabled={posting}>
            {posting
              ? 'Saving...'
              : editingId
                ? 'Save changes'
                : 'Post job'}
          </button>

          {editingId && (
            <button type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </form>
      )}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {jobs.length === 0 && <p>No jobs yet.</p>}

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 12 }}>
        {jobs.map((j) => {
          const req = j.structured_requirements || {};
          return (
            <li key={j.id} style={{ border: '1px solid #ccc', padding: 14 }}>
              <strong>{j.title}</strong>
              {j.company_name && ` - ${j.company_name}`}
              {j.category && ` (${j.category})`}
              <p style={{ margin: '6px 0' }}><em>{req.summary}</em></p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {req.required_skills?.map((s) => (
                  <span key={s} style={{ background: '#eee', padding: '2px 8px', borderRadius: 12 }}>{s}</span>
                ))}
              </div>
              <p style={{ margin: '6px 0' }}>
                Experience: {req.min_years_experience ?? 0}+ years
              </p>
              {!isCompany && <Link to={`/match?job=${j.id}`}>Check my match</Link>}
              {isCompany && <Link to={`/jobs/${j.id}/applicants`}>View applicants</Link>}

              {isCompany && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 8,
                  alignItems: 'center'
                }}>
                  <span>
                    Status: <b>{j.status}</b>
                  </span>

                  <button onClick={() => startEdit(j)}>
                    Edit
                  </button>

                  <button onClick={() => toggleStatus(j)}>
                    {j.status === 'closed' ? 'Reopen' : 'Close'}
                  </button>

                  <button onClick={() => remove(j)}>
                    Delete
                  </button>
                </div>
              )}

            </li>
          );
        })}
      </ul>
    </div>
  );
}