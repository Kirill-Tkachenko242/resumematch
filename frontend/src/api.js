const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const getToken = () => localStorage.getItem('token');
export const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');

export function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  register: (body) => request('/api/auth/register', json(body)),
  login: (body) => request('/api/auth/login', json(body)),
  listResumes: () => request('/api/resumes'),
  uploadResume: (file, resumeId) => {
    const fd = new FormData();
    fd.append('file', file);
    if (resumeId) fd.append('resume_id', resumeId);
    return request('/api/resumes', { method: 'POST', body: fd });
  },
  extract: (versionId) =>
    request(`/api/resumes/versions/${versionId}/extract`, { method: 'POST' }),
};