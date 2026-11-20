// Compares the scoring engine with manual scores. Run from backend: node eval/evaluate.js
const { scoreMatch } = require('../services/scoring');
const data = require('./dataset.json');

const rows = [];
let within = 0;
let errSum = 0;
let counted = 0;
const missing = [];

for (const [pairId, manual] of Object.entries(data.manual_scores)) {
  if (manual === null || manual === undefined) { missing.push(pairId); continue; }
  const [rid, jid] = pairId.split('-');
  const resume = data.resumes[rid];
  const job = data.jobs[jid];
  const r = scoreMatch({ ...resume, text: resume.text || '' }, job, {});
  const diff = r.overall === null ? null : Math.round(Math.abs(r.overall - manual) * 10) / 10;
  if (diff !== null) {
    counted++;
    errSum += diff;
    if (diff <= 10) within++;
  }
  rows.push({ pair: pairId, resume: resume.label, job: job.title, manual, system: r.overall, diff });
}

if (missing.length) {
  console.log(`Fill in manual_scores first (0-100). Missing: ${missing.join(', ')}`);
}
if (rows.length) {
  console.table(rows);
  console.log(`Within 10 points: ${within}/${rows.length} (${Math.round((100 * within) / rows.length)}%)`);
  console.log(`Mean absolute error: ${counted ? (errSum / counted).toFixed(1) : 'n/a'}`);
}
