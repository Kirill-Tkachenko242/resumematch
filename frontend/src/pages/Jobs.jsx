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
      await api.postJob({ ...form, category_id: form.category_id || undefined });
      setForm({ title: '', category_id: '', description: '' });
      setRefresh((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <h1>{isCompany ? 'My job postings' : 'Open jobs'}</h1>

      {isCompany && (
        <form onSubmit={post} style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
          <h3>Post a job</h3>
          <input name="title" placeholder="Job title" value={form.title} onChange={update} required />
          <select name="category_id" value={form.category_id} onChange={update}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <textarea name="description" rows={8} placeholder="Job description (skills, experience, education...)"
            value={form.description} onChange={update} required />
          <button type="submit" disabled={posting}>
            {posting ? 'Analysing description...' : 'Post job'}
          </button>
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}