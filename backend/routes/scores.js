const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { extractResumeData, extractJobData } = require('../services/claude');
const { scoreMatch } = require('../services/scoring');

const router = express.Router();

// POST /api/scores  { resume_version_id, job_id }  or  { resume_version_id, job_text }
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'candidate') {
    return res.status(403).json({ error: 'Only candidates can analyse resumes' });
  }
  const { resume_version_id, job_id, job_text } = req.body;
  if (!resume_version_id || (!job_id && !job_text)) {
    return res.status(400).json({ error: 'resume_version_id and job_id or job_text are required' });
  }
  if (job_text && job_text.length > 20000) {
    return res.status(400).json({ error: 'Job text too long (max 20000 characters)' });
  }

  try {
    const v = await pool.query(
      `SELECT v.id, v.parsed_text, v.structured_data
       FROM resume_versions v JOIN resumes r ON r.id = v.resume_id
       WHERE v.id = $1 AND r.user_id = $2`,
      [resume_version_id, req.user.id]
    );
    if (!v.rows[0]) return res.status(404).json({ error: 'Resume version not found' });

    let resumeData = v.rows[0].structured_data;
    if (!resumeData) {
      resumeData = await extractResumeData(v.rows[0].parsed_text);
      await pool.query('UPDATE resume_versions SET structured_data = $1 WHERE id = $2',
        [JSON.stringify(resumeData), resume_version_id]);
    }

    let job;
    let category = {};
    if (job_id) {
      const j = await pool.query(
        `SELECT j.title, j.structured_requirements, c.accepted_degrees, c.skill_weights
         FROM job_postings j LEFT JOIN job_categories c ON c.id = j.category_id
         WHERE j.id = $1 AND j.status = 'active'`,
        [job_id]
      );
      if (!j.rows[0]) return res.status(404).json({ error: 'Job not found' });
      job = { ...j.rows[0].structured_requirements, title: j.rows[0].title };
      category = {
        accepted_degrees: j.rows[0].accepted_degrees || [],
        skill_weights: j.rows[0].skill_weights || {},
      };
    } else {
      job = await extractJobData(job_text);
    }

    const result = scoreMatch({ ...resumeData, text: v.rows[0].parsed_text }, job, category);
    if (result.overall === null) {
      return res.status(422).json({ error: 'Not enough information in the job description to score' });
    }

    const saved = await pool.query(
      `INSERT INTO match_scores (resume_version_id, job_id, job_text, overall_score, category_scores, explanation)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [resume_version_id, job_id || null, job_id ? null : job_text,
       result.overall, JSON.stringify(result.categories), JSON.stringify(result.details)]
    );

    res.status(201).json({ id: saved.rows[0].id, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Scoring failed' });
  }
});

// GET /api/scores/history?resume_id=1&job_id=2  (score over resume versions)
router.get('/history', auth, async (req, res) => {
  const { resume_id, job_id } = req.query;
  if (!resume_id || !job_id) {
    return res.status(400).json({ error: 'resume_id and job_id are required' });
  }
  try {
    const result = await pool.query(
      `SELECT s.id, v.version_number, s.overall_score, s.category_scores, s.created_at
       FROM match_scores s
       JOIN resume_versions v ON v.id = s.resume_version_id
       JOIN resumes r ON r.id = v.resume_id
       WHERE r.user_id = $1 AND r.id = $2 AND s.job_id = $3
       ORDER BY s.created_at`,
      [req.user.id, resume_id, job_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;