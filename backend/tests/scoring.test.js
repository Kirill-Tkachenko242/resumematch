const test = require('node:test');
const assert = require('node:assert');
const { scoreMatch, scoreSkills, scoreExperience, scoreKeywords } = require('../services/scoring');

const job = {
  title: 'Software Engineer',
  required_skills: ['Python', 'SQL', 'Git', 'REST APIs'],
  nice_to_have_skills: ['Docker'],
  min_years_experience: 2,
  accepted_fields_of_study: [],
};
const weights = { Python: 35, SQL: 25, Git: 15, 'REST APIs': 25 };

test('all required skills present gives 100', () => {
  const r = scoreSkills({ skills: ['Python', 'SQL', 'Git', 'REST APIs'], text: '' }, job);
  assert.strictEqual(r.score, 100);
  assert.deepStrictEqual(r.missing, []);
});

test('missing skill lowers score and is reported', () => {
  const r = scoreSkills({ skills: ['Python', 'SQL', 'REST APIs'], text: '' }, job, weights);
  assert.strictEqual(r.score, 85);
  assert.deepStrictEqual(r.missing, ['git']);
});

test('admin weights change the result', () => {
  const resume = { skills: ['SQL', 'Git', 'REST APIs'], text: '' };
  assert.strictEqual(scoreSkills(resume, job).score, 75);
  assert.strictEqual(scoreSkills(resume, job, weights).score, 65);
});

test('skill found only in resume text still counts', () => {
  const resume = { skills: [], text: 'I built REST APIs in Python and used SQL and Git daily' };
  assert.strictEqual(scoreSkills(resume, job).score, 100);
});

test('aliases are normalised (Postgres = PostgreSQL)', () => {
  const r = scoreSkills({ skills: ['Postgres'], text: '' }, { required_skills: ['PostgreSQL'] });
  assert.strictEqual(r.score, 100);
});

test('java does not match javascript', () => {
  const r = scoreSkills({ skills: [], text: 'expert in javascript' }, { required_skills: ['Java'] });
  assert.strictEqual(r.score, 0);
});

test('special characters in skill names do not break matching', () => {
  const r = scoreSkills({ skills: [], text: 'five years of c++ development' }, { required_skills: ['C++'] });
  assert.strictEqual(r.score, 100);
});

test('no required skills gives null score', () => {
  assert.strictEqual(scoreSkills({ skills: ['Python'], text: '' }, {}).score, null);
});

test('experience below requirement is scaled', () => {
  const r = scoreExperience({ years_of_experience: 1, education: [] }, job, {});
  assert.strictEqual(r.score, 65); // 0.7 * 50 + 0.3 * 100
});

test('education mismatch costs 30 points; admin category can fix it', () => {
  const resume = { years_of_experience: 3, education: [{ degree: 'Higher Diploma', field: 'Computing' }] };
  assert.strictEqual(scoreExperience(resume, job, { accepted_degrees: ['Computer Science'] }).score, 70);
  assert.strictEqual(scoreExperience(resume, job, { accepted_degrees: ['Computing'] }).score, 100);
});

test('keywords: null when the job has none', () => {
  assert.strictEqual(scoreKeywords({ text: 'anything' }, { title: '', nice_to_have_skills: [] }).score, null);
});

test('keywords: share of found terms', () => {
  const r = scoreKeywords({ text: 'software developer using docker' }, job);
  assert.strictEqual(r.score, 66.7); // software, docker found; engineer missing
});

test('overall: perfect match is 100', () => {
  const resume = {
    skills: ['Python', 'SQL', 'Git', 'REST APIs', 'Docker'],
    years_of_experience: 3, education: [],
    text: 'software engineer with docker',
  };
  assert.strictEqual(scoreMatch(resume, job).overall, 100);
});

test('overall: categories without data are skipped and weights renormalised', () => {
  const resume = { skills: ['Python'], years_of_experience: 5, education: [], text: '' };
  const r = scoreMatch(resume, { required_skills: ['Python'], min_years_experience: 1 });
  assert.strictEqual(r.categories.keywords, null);
  assert.strictEqual(r.overall, 100);
});