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
      if (data.user.role === 'admin') {
        navigate('/admin');
      } else if (data.user.role === 'company') {
        navigate('/jobs');
      } else {
        navigate('/resumes');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth">
      <div className="brand" style={{ marginBottom: 28 }}>
        <span className="brand-mark">RM</span>
        ResumeMatch
      </div>

      <form className="panel" onSubmit={submit}>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>{mode === 'login' ? 'Log in' : 'Create account'}</h1>
        <p className="muted" style={{ margin: '0 0 24px' }}>
          {mode === 'login' ? 'Welcome back.' : 'Choose whether you are a candidate or a company.'}
        </p>

        {mode === 'register' && (
          <>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" type="text" name="name" value={form.name} onChange={update} required />
            </div>
            <div className="field">
              <label htmlFor="role">I am a</label>
              <select id="role" name="role" value={form.role} onChange={update}>
                <option value="candidate">Candidate</option>
                <option value="company">Company</option>
              </select>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" name="email" value={form.email} onChange={update} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" name="password" value={form.password} onChange={update} required />
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn primary" type="submit" style={{ width: '100%' }}>
          {mode === 'login' ? 'Log in' : 'Register'}
        </button>
        <p style={{ textAlign: 'center', margin: '16px 0 0' }}>
          <button className="linkbtn" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
          </button>
        </p>
      </form>
    </div>
  );
}
