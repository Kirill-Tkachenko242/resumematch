import { useEffect, useState } from 'react';
import { api } from '../api';

const weightsToText = (w) => Object.entries(w || {}).map(([k, v]) => `${k}: ${v}`).join('\n');

function textToWeights(text) {
  const out = {};
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const i = line.lastIndexOf(':');
    if (i < 1) throw new Error(`Bad line: "${line}". Use "Skill: 30"`);
    out[line.slice(0, i).trim()] = Number(line.slice(i + 1));
  }
  return out;
}

function CategoryEditor({ cat }) {
  const [degrees, setDegrees] = useState((cat.accepted_degrees || []).join(', '));
  const [weights, setWeights] = useState(weightsToText(cat.skill_weights));
  const [msg, setMsg] = useState('');

  async function save() {
    setMsg('');
    try {
      await api.adminSaveCategory(cat.id, {
        accepted_degrees: degrees.split(',').map((s) => s.trim()).filter(Boolean),
        skill_weights: textToWeights(weights),
      });
      setMsg('Saved. New matches use these rules immediately.');
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 14, marginBottom: 16, display: 'grid', gap: 8 }}>
      <h3 style={{ margin: 0 }}>{cat.name}</h3>
      <label>Accepted degrees (comma separated)
        <input style={{ width: '100%' }} value={degrees} onChange={(e) => setDegrees(e.target.value)} />
      </label>
      <label>Skill weights (one per line, "Skill: weight 0-100")
        <textarea style={{ width: '100%' }} rows={6} value={weights} onChange={(e) => setWeights(e.target.value)} />
      </label>
      <button onClick={save}>Save</button>
      {msg && <p style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}

export default function Admin() {
  const [cats, setCats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.adminCategories()
      .then((d) => { if (!cancelled) setCats(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <h1>Matching rules</h1>
      <p>Weights decide how much each required skill counts in the skills score. Degrees decide which education counts as a match.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!cats && !error && <p>Loading...</p>}
      {cats && cats.map((c) => <CategoryEditor key={c.id} cat={c} />)}
    </div>
  );
}