const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { extractResumeData } = require('../services/claude');
const { scoreMatch } = require('../services/scoring');

const router = express.Router();

// POST /api/applications  { resume_version_id, job_id }  (candidate)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'candidate') {
    return res.status(403).json({ error: 'Only candidates can apply' });
  }
  const { resume_version_id, job_id } = req.body || {};;
  if (!resume_version_id || !job_id) {
    return res.status(400).json({ error: 'resume_version_id and job_id are required' });
  }

  try {
    // the resume version must belong to this candidate
    const v = await pool.query(
      `SELECT v.id, v.parsed_text, v.structured_data
       FROM resume_versions v JOIN resumes r ON r.id = v.resume_id
       WHERE v.id = $1 AND r.user_id = $2`,
      [resume_version_id, req.user.id]
    );
    if (!v.rows[0]) return res.status(403).json({ error: 'This resume version is not yours' });

    const j = await pool.query(
      `SELECT j.title, j.structured_requirements, c.accepted_degrees, c.skill_weights
       FROM job_postings j LEFT JOIN job_categories c ON c.id = j.category_id
       WHERE j.id = $1 AND j.status = 'active'`,
      [job_id]
    );
    if (!j.rows[0]) return res.status(404).json({ error: 'Job not found' });

    let resumeData = v.rows[0].structured_data;
    if (!resumeData) {
      resumeData = await extractResumeData(v.rows[0].parsed_text);
      await pool.query('UPDATE resume_versions SET structured_data = $1 WHERE id = $2',
        [JSON.stringify(resumeData), resume_version_id]);
    }

    const job = { ...j.rows[0].structured_requirements, title: j.rows[0].title };
    const category = {
      accepted_degrees: j.rows[0].accepted_degrees || [],
      skill_weights: j.rows[0].skill_weights || {},
    };
    const result = scoreMatch({ ...resumeData, text: v.rows[0].parsed_text }, job, category);
    if (result.overall === null) {
      return res.status(422).json({ error: 'Not enough information in the job description to score' });
    }

    // one application per candidate and job; re-applying replaces the resume version
    const app = await pool.query(
      `INSERT INTO applications
         (user_id, job_id, resume_version_id, overall_score, category_scores, explanation)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, job_id) DO UPDATE SET
         resume_version_id = EXCLUDED.resume_version_id,
         overall_score     = EXCLUDED.overall_score,
         category_scores   = EXCLUDED.category_scores,
         explanation       = EXCLUDED.explanation,
         status            = 'submitted',
         updated_at        = NOW()
       RETURNING id`,
      [req.user.id, job_id, resume_version_id, result.overall,
       JSON.stringify(result.categories), JSON.stringify(result.details)]
    );

    // keep the history too
    await pool.query(
      `INSERT INTO match_scores
         (resume_version_id, job_id, application_id, overall_score, category_scores, explanation)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [resume_version_id, job_id, app.rows[0].id, result.overall,
       JSON.stringify(result.categories), JSON.stringify(result.details)]
    );

    res.status(201).json({ id: app.rows[0].id, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Application failed' });
  }
});

// GET /api/applications/mine  (candidate)
router.get('/mine', auth, async (req, res) => {
  if (req.user.role !== 'candidate') return res.status(403).json({ error: 'Candidates only' });
  try {
    const r = await pool.query(
      `SELECT a.id, a.job_id, a.overall_score, a.status, a.updated_at,
              j.title, v.version_number
       FROM applications a
       JOIN job_postings j ON j.id = a.job_id
       JOIN resume_versions v ON v.id = a.resume_version_id
       WHERE a.user_id = $1
       ORDER BY a.updated_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/applications/job/:jobId  (company, own job only) - ranked by score
router.get('/job/:jobId', auth, async (req, res) => {
  if (req.user.role !== 'company') return res.status(403).json({ error: 'Companies only' });
  try {
    const job = await pool.query(
      'SELECT id, title FROM job_postings WHERE id = $1 AND company_id = $2',
      [req.params.jobId, req.user.id]
    );
    if (!job.rows[0]) return res.status(403).json({ error: 'This is not your job posting' });

    const r = await pool.query(
      `SELECT a.id, a.overall_score, a.category_scores, a.explanation, a.status, a.updated_at,
              u.name AS candidate_name, v.version_number, r.title AS resume_title
       FROM applications a
       JOIN users u ON u.id = a.user_id
       JOIN resume_versions v ON v.id = a.resume_version_id
       JOIN resumes r ON r.id = v.resume_id
       WHERE a.job_id = $1
       ORDER BY a.overall_score DESC, a.updated_at ASC`,
      [req.params.jobId]
    );
    res.json({ job: job.rows[0], applicants: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;