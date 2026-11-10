import { Link, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../api';

export default function Nav() {
  const user = getUser();
  const navigate = useNavigate();

  return (
    <nav style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
      <strong>ResumeMatch</strong>
      {user?.role === 'candidate' && <Link to="/resumes">My Resumes</Link>}
      <Link to="/jobs">{user?.role === 'company' ? 'My Jobs' : 'Browse Jobs'}</Link>
      {user?.role === 'candidate' && <Link to="/match">Match score</Link>}
      <span style={{ marginLeft: 'auto' }}>
        {user?.name} ({user?.role}){' '}
        <button onClick={() => { logout(); navigate('/login'); }}>Log out</button>
      </span>
    </nav>
  );
}