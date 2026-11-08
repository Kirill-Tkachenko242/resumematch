import { Link } from 'react-router-dom';
import { getUser } from '../api';

export default function Nav() {
  const user = getUser();
  return (
    <nav style={{ display: 'flex', gap: 16, padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
      <strong>ResumeMatch</strong>
      {user?.role === 'candidate' && <Link to="/resumes">My Resumes</Link>}
      <Link to="/jobs">{user?.role === 'company' ? 'My Jobs' : 'Browse Jobs'}</Link>
      {user?.role === 'candidate' && <Link to="/match">Match score</Link>}
    </nav>
  );
}