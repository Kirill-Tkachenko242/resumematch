import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../api';

export default function Nav() {
  const user = getUser();
  const navigate = useNavigate();
  const path = useLocation().pathname;

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

  return (
    <header className="topbar">
      <Link className="brand" to="/">
        <span className="brand-mark">RM</span>
        ResumeMatch
      </Link>

      <nav className="tabs">
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} className={`tab${t.active ? ' active' : ''}`}>{t.label}</Link>
        ))}
      </nav>

      <div className="topbar-user">
        <span>{user?.name}</span>
        <button className="btn small" onClick={() => { logout(); navigate('/login'); }}>
          Log out
        </button>
      </div>
    </header>
  );
}
