import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession } from '../api';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'candidate' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'register') await api.register(form);
      const data = await api.login({ email: form.email, password: form.password });
      setSession(data.token, data.user);
      navigate('/resumes');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 360, margin: '80px auto', display: 'grid', gap: 12 }}>
      <h1>ResumeMatch</h1>
      <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>

      {mode === 'register' && (
        <>
          <input name="name" placeholder="Name" value={form.name} onChange={update} required />
          <select name="role" value={form.role} onChange={update}>
            <option value="candidate">Candidate</option>
            <option value="company">Company</option>
          </select>
        </>
      )}
      <input name="email" type="email" placeholder="Email" value={form.email} onChange={update} required />
      <input name="password" type="password" placeholder="Password" value={form.password} onChange={update} required />

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button type="submit">{mode === 'login' ? 'Log in' : 'Register'}</button>
      <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
      </button>
    </form>
  );
}