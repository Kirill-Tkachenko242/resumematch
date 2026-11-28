import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../api';

export default function Nav() {
  const user = getUser();
  const navigate = useNavigate();
  const path = useLocation().pathname;

  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  };

  // tabs depend on the role
  let tabs;
  if (user?.role === 'admin') {
    tabs = [{ to: '/admin', label: 'Matching rules', active: path.startsWith('/admin') }];
  } else if (user?.role === 'company') {
    tabs = [
      { to: '/jobs', label: 'Job Postings', active: path === '/jobs' },
      { to: '/applicants', label: 'Applicants', active: path.includes('/applicants') },
    ];
  } else {
    tabs = [
      { to: '/resumes', label: 'My Resumes', active: path.startsWith('/resumes') },
      { to: '/jobs', label: 'Browse Jobs', active: path.startsWith('/jobs') },
      { to: '/match', label: 'Match score', active: path.startsWith('/match') },
    ];
  }
  const homePath =
    user?.role === 'admin'
      ? '/admin'
      : user?.role === 'company'
        ? '/jobs'
        : '/resumes';

  return (
    <header className="topbar">
      <Link className="brand" to={homePath}>
        <img className="brand-logo" src="/Logo_white.png" alt="ResumeMatch" />
        ResumeMatch
      </Link>

      <nav className="tabs">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={`tab${t.active ? ' active' : ''}`}>{t.label}</Link>
        ))}
      </nav>

      <div className="topbar-user">
        <button
          type="button"
          className="btn small"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <span>{user?.name}</span>
        <button className="btn small" onClick={() => { logout(); navigate('/login'); }}>
          Log out
        </button>
      </div>
    </header>
  );
}