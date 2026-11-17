const test = require('node:test');
const assert = require('node:assert');

const BASE = process.env.BASE_URL;
const skip = !BASE && 'set BASE_URL to run integration tests';

const stamp = Date.now();
const candidate = { name: 'Test Candidate', email: `cand${stamp}@test.com`, password: 'Passw0rd!x', role: 'candidate' };
const company = { name: 'Test Company', email: `comp${stamp}@test.com`, password: 'Passw0rd!x', role: 'company' };

async function call(path, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { status: res.status, data };
}

let candToken;
let compToken;

test('register and login candidate and company', { skip }, async () => {
  assert.strictEqual((await call('/api/auth/register', { method: 'POST', body: candidate })).status, 201);
  assert.strictEqual((await call('/api/auth/register', { method: 'POST', body: company })).status, 201);
  const c = await call('/api/auth/login', { method: 'POST', body: { email: candidate.email, password: candidate.password } });
  assert.strictEqual(c.status, 200);
  candToken = c.data.token;
  const k = await call('/api/auth/login', { method: 'POST', body: { email: company.email, password: company.password } });
  compToken = k.data.token;
  assert.ok(candToken && compToken);
});

test('duplicate email is rejected with 409', { skip }, async () => {
  assert.strictEqual((await call('/api/auth/register', { method: 'POST', body: candidate })).status, 409);
});

test('wrong password gives 401', { skip }, async () => {
  const r = await call('/api/auth/login', { method: 'POST', body: { email: candidate.email, password: 'wrong' } });
  assert.strictEqual(r.status, 401);
});

test('admin cannot self-register', { skip }, async () => {
  const r = await call('/api/auth/register', {
    method: 'POST', body: { name: 'Evil', email: `evil${stamp}@test.com`, password: 'Passw0rd!x', role: 'admin' },
  });
  assert.ok(r.status >= 400 && r.status < 500);
});

test('SQL injection in login does not authenticate', { skip }, async () => {
  const r = await call('/api/auth/login', { method: 'POST', body: { email: "' OR 1=1 --", password: "' OR '1'='1" } });
  assert.ok(r.status === 400 || r.status === 401);
});

test('protected routes without token give 401', { skip }, async () => {
  assert.strictEqual((await call('/api/resumes')).status, 401);
  assert.strictEqual((await call('/api/admin/categories')).status, 401);
});

test('role checks: wrong role gets 403', { skip }, async () => {
  assert.strictEqual((await call('/api/jobs', { method: 'POST', token: candToken, body: { title: 'x', description: 'y' } })).status, 403);
  assert.strictEqual((await call('/api/admin/categories', { token: candToken })).status, 403);
  assert.strictEqual((await call('/api/admin/categories', { token: compToken })).status, 403);
  assert.strictEqual((await call('/api/applications', { method: 'POST', token: compToken, body: { resume_version_id: 1, job_id: 1 } })).status, 403);
});

test('applications: bad input gives 400, foreign resume gives 403/404', { skip }, async () => {
  assert.strictEqual((await call('/api/applications', { method: 'POST', token: candToken, body: {} })).status, 400);
  const r = await call('/api/applications', { method: 'POST', token: candToken, body: { resume_version_id: 1, job_id: 1 } });
  assert.ok(r.status === 403 || r.status === 404);
});

test('scores: pasted job text over the limit is rejected', { skip }, async () => {
  const r = await call('/api/scores', { method: 'POST', token: candToken, body: { resume_version_id: 1, job_text: 'a'.repeat(20001) } });
  assert.strictEqual(r.status, 400);
});

test('upload: a .txt renamed to .pdf is rejected', { skip }, async () => {
  const form = new FormData();
  form.append('file', new Blob(['this is not a pdf']), 'fake.pdf'); // field name must match your multer config
  const r = await call('/api/resumes', { method: 'POST', token: candToken, form });
  assert.strictEqual(r.status, 400);
});