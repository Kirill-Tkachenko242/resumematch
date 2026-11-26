const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// every route here: valid token AND role = admin
router.use(auth, (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
});

function cleanDegrees(v) {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => String(x).trim()).filter(Boolean);
  return out.length <= 30 && out.every((x) => x.length <= 100) ? out : null;
}

function cleanWeights(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const n = Number(val);
    const key = k.trim();
    if (!key || key.length > 60 || !Number.isFinite(n) || n < 0 || n > 100) return null;
    out[key] = n;
  }
  return Object.keys(out).length <= 50 ? out : null;
}

// GET /api/admin/categories
router.get('/categories', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, name, accepted_degrees, skill_weights FROM job_categories ORDER BY name'
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/categories/:id  { accepted_degrees?, skill_weights? }
router.put('/categories/:id', async (req, res) => {
  const body = req.body || {};
  const degrees = body.accepted_degrees === undefined ? null : cleanDegrees(body.accepted_degrees);
  const weights = body.skill_weights === undefined ? null : cleanWeights(body.skill_weights);
  if (body.accepted_degrees !== undefined && degrees === null) {
    return res.status(400).json({ error: 'accepted_degrees must be a list of short strings' });
  }
  if (body.skill_weights !== undefined && weights === null) {
    return res.status(400).json({ error: 'skill_weights must be {skill: number 0-100}' });
  }
  try {
    const r = await pool.query(
      `UPDATE job_categories
       SET accepted_degrees = COALESCE($1, accepted_degrees),
           skill_weights    = COALESCE($2, skill_weights)
       WHERE id = $3
       RETURNING id, name, accepted_degrees, skill_weights`,
      [degrees && JSON.stringify(degrees), weights && JSON.stringify(weights), req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Category not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT (SELECT COUNT(*) FROM users) AS users,
              (SELECT COUNT(DISTINCT resume_version_id) FROM match_scores) AS resumes_analyzed,
              (SELECT COUNT(*) FROM job_postings) AS jobs`
    );
    const row = r.rows[0];
    res.json({ users: Number(row.users), resumes_analyzed: Number(row.resumes_analyzed), jobs: Number(row.jobs) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;