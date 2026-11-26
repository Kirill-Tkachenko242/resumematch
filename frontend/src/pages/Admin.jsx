import { useEffect, useState } from 'react';
import { api } from '../api';

const toDraft = (c) => ({
  id: c.id,
  name: c.name,
  degrees: (c.accepted_degrees || []).join('; '),
  weights: Object.entries(c.skill_weights || {}).map(([skill, weight]) => ({ skill, weight: String(weight) })),
});

const total = (c) => c.weights.reduce((sum, w) => sum + (Number(w.weight) || 0), 0);

// a category is valid when it has no weights (defaults apply) or its weights add up to 100
function problem(c) {
  if (c.weights.some((w) => !w.skill.trim())) return 'every skill needs a name';
  const names = c.weights.map((w) => w.skill.trim().toLowerCase());
  if (new Set(names).size !== names.length) return 'skill names must be unique';
  if (c.weights.length && total(c) !== 100) return 'weights must total 100%';
  return '';
}

export default function Admin() {
  const [draft, setDraft] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.adminCategories()
      .then((d) => { if (!cancelled) setDraft(d.map(toDraft)); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    api.adminStats()
      .then((d) => { if (!cancelled) setStats(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const edit = (idx, fn) => {
    setMsg('');
    setDraft((d) => d.map((c, i) => (i === idx ? fn(c) : c)));
  };

  const hasProblem = draft ? draft.some((c) => problem(c)) : false;

  async function save() {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      for (const c of draft) {
        await api.adminSaveCategory(c.id, {
          accepted_degrees: c.degrees.split(';').map((s) => s.trim()).filter(Boolean),
          skill_weights: Object.fromEntries(c.weights.map((w) => [w.skill.trim(), Number(w.weight)])),
        });
      }
      setMsg('Saved. Changes apply to future resume analyses.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="admin-shell">
        <aside className="sidebar">
          <h2 style={{ fontSize: 22, marginBottom: 20 }}>Admin panel</h2>
          <div className="item active">Job categories</div>
          <p className="muted" style={{ fontSize: 14 }}>Manage matching criteria that the scoring engine reads.</p>
        </aside>

        <main className="admin-main">
          <h1 className="page-title" style={{ fontSize: 32 }}>Job categories</h1>
          <p className="lead">Configure accepted degree backgrounds and skill weights for each role.</p>

          {stats && (
            <div className="cards" style={{ marginBottom: 32 }}>
              <div className="stat"><div className="stat-label">Total users</div><div className="stat-value">{stats.users}</div></div>
              <div className="stat"><div className="stat-label">Total resumes analyzed</div><div className="stat-value">{stats.resumes_analyzed}</div></div>
              <div className="stat"><div className="stat-label">Total jobs posted</div><div className="stat-value">{stats.jobs}</div></div>
            </div>
          )}

          <h2 style={{ fontSize: 22 }}>Matching criteria</h2>
          <p className="muted" style={{ margin: '4px 0 16px' }}>
            Separate degrees with semicolons. Skill weights within each category must total 100%.
          </p>

          {error && <p className="error">{error}</p>}
          {!draft && !error && <p className="muted">Loading...</p>}

          {draft && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Job category</th>
                    <th>Accepted degree backgrounds</th>
                    <th>Required skill weightings</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.map((c, idx) => {
                    const p = problem(c);
                    return (
                      <tr key={c.id} style={{ verticalAlign: 'top' }}>
                        <td><strong>{c.name}</strong></td>
                        <td style={{ minWidth: 220 }}>
                          <textarea rows={3} value={c.degrees} aria-label={`Accepted degrees for ${c.name}`}
                            onChange={(e) => edit(idx, (x) => ({ ...x, degrees: e.target.value }))} />
                        </td>
                        <td style={{ minWidth: 320 }}>
                          {c.weights.map((w, wi) => (
                            <div className="weights-row" key={wi}>
                              <input type="text" value={w.skill} placeholder="Skill" aria-label="Skill name"
                                onChange={(e) => edit(idx, (x) => ({
                                  ...x, weights: x.weights.map((y, i) => (i === wi ? { ...y, skill: e.target.value } : y)),
                                }))} />
                              <input type="number" min="0" max="100" value={w.weight} aria-label="Weight in percent"
                                onChange={(e) => edit(idx, (x) => ({
                                  ...x, weights: x.weights.map((y, i) => (i === wi ? { ...y, weight: e.target.value } : y)),
                                }))} />
                              <button className="btn small" type="button" aria-label="Remove skill"
                                onClick={() => edit(idx, (x) => ({ ...x, weights: x.weights.filter((_, i) => i !== wi) }))}>
                                ×
                              </button>
                            </div>
                          ))}
                          <button className="btn small" type="button"
                            onClick={() => edit(idx, (x) => ({ ...x, weights: [...x.weights, { skill: '', weight: '0' }] }))}>
                            + Add skill
                          </button>
                          <div className={`total ${p ? 'bad' : ''}`}>
                            Total: {total(c)}%{p ? ` (${p})` : ''}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="row" style={{ marginTop: 24 }}>
            <button className="btn primary" onClick={save} disabled={!draft || hasProblem || saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <span className="muted">Changes apply to future resume analyses.</span>
          </div>
          {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
        </main>
      </div>
    </div>
  );
}
