import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../api';

export default function Resumes() {
  const navigate = useNavigate();
  const user = getUser();

  return (
    <div style={{ maxWidth: 800, margin: '40px auto' }}>
      <h1>My Resumes</h1>
      <p>Logged in as {user?.name} ({user?.role})</p>
      <button onClick={() => { logout(); navigate('/login'); }}>Log out</button>
    </div>
  );
}