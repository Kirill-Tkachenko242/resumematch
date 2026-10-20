const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Check the real file content, not just the extension
function detectType(buf) {
  if (buf.slice(0, 4).toString() === '%PDF') return 'pdf';
  if (buf[0] === 0x50 && buf[1] === 0x4b) return 'docx'; // zip signature "PK"
  return null;
}

// POST /api/resumes  (form field "file", optional "resume_id" to add a new version)
router.post('/', auth, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'candidate') {
    return res.status(403).json({ error: 'Only candidates can upload resumes' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const type = detectType(req.file.buffer);
  if (!type) return res.status(400).json({ error: 'Only PDF or DOCX files are allowed' });

  let text;
  try {
    if (type === 'pdf') {
      text = (await pdfParse(req.file.buffer)).text;
    } else {
      text = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
    }
  } catch {
    return res.status(400).json({ error: 'Could not read the file' });
  }

  text = (text || '').trim();
  if (!text) return res.status(400).json({ error: 'No text found in the file' });

  try {
    let resumeId = req.body.resume_id;

    if (resumeId) {
      const own = await pool.query(
        'SELECT id FROM resumes WHERE id = $1 AND user_id = $2',
        [resumeId, req.user.id]
      );
      if (!own.rows[0]) return res.status(404).json({ error: 'Resume not found' });
    } else {
      const created = await pool.query(
        'INSERT INTO resumes (user_id, title) VALUES ($1, $2) RETURNING id',
        [req.user.id, req.file.originalname]
      );
      resumeId = created.rows[0].id;
    }

    const version = await pool.query(
      `INSERT INTO resume_versions (resume_id, version_number, file_name, parsed_text)
       VALUES ($1,
               COALESCE((SELECT MAX(version_number) FROM resume_versions WHERE resume_id = $1), 0) + 1,
               $2, $3)
       RETURNING id, resume_id, version_number, file_name, created_at`,
      [resumeId, req.file.originalname, text]
    );

    res.status(201).json(version.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/resumes  (all my resumes with their versions)
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id AS resume_id, r.title, v.id AS version_id,
              v.version_number, v.file_name, v.created_at
       FROM resumes r
       JOIN resume_versions v ON v.resume_id = r.id
       WHERE r.user_id = $1
       ORDER BY r.id, v.version_number`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Friendly error for oversized files
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 10 MB)' });
  }
  next(err);
});

module.exports = router;

const { extractResumeData } = require('../services/claude');
// POST /api/resumes/versions/:versionId/extract
router.post('/versions/:versionId/extract', auth, async (req, res) => {
  try {
    const found = await pool.query(
      `SELECT v.id, v.parsed_text FROM resume_versions v
       JOIN resumes r ON r.id = v.resume_id
       WHERE v.id = $1 AND r.user_id = $2`,
      [req.params.versionId, req.user.id]
    );
    if (!found.rows[0]) return res.status(404).json({ error: 'Version not found' });

    const data = await extractResumeData(found.rows[0].parsed_text);

    await pool.query(
      'UPDATE resume_versions SET structured_data = $1 WHERE id = $2',
      [JSON.stringify(data), req.params.versionId]
    );
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Extraction failed' });
  }
});