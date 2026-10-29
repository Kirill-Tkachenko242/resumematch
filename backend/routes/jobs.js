const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { extractJobData } = require('../services/claude');

const router = express.Router();

// GET /api/jobs/categories
router.get('/categories', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM job_categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/jobs  (company only)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'company') {
    return res.status(403).json({ error: 'Only companies can post jobs' });
  }

  const { title, description, category_id } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }
  if (description.length > 20000) {
    return res.status(400).json({ error: 'Description too long (max 20000 characters)' });
  }

  let requirements;
  try {
    requirements = await extractJobData(description);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: 'Could not analyse the job description' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO job_postings (company_id, category_id, title, description, structured_requirements)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, category_id, structured_requirements, status, created_at`,
      [req.user.id, category_id || null, title, description, JSON.stringify(requirements)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Unknown category' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/jobs  (all active jobs, any logged-in user)
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.id, j.title, j.description, j.structured_requirements, j.created_at,
              u.name AS company_name, c.name AS category
       FROM job_postings j
       JOIN users u ON u.id = j.company_id
       LEFT JOIN job_categories c ON c.id = j.category_id
       WHERE j.status = 'active'
       ORDER BY j.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/jobs/mine  (company's own jobs)
router.get('/mine', auth, async (req, res) => {
  if (req.user.role !== 'company') {
    return res.status(403).json({ error: 'Only companies have job postings' });
  }
  try {
    const result = await pool.query(
      `SELECT id, title, structured_requirements, status, created_at
       FROM job_postings WHERE company_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;