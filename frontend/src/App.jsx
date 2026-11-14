import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Resumes from './pages/Resumes';
import Jobs from './pages/Jobs';
import Match from './pages/Match';
import Nav from './components/Nav';
import { getToken } from './api';
import Applicants from './pages/Applicants';

function Protected({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return (
    <>
      <Nav />
      {children}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth />} />
      <Route path="/resumes" element={<Protected><Resumes /></Protected>} />
      <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
      <Route path="/match" element={<Protected><Match /></Protected>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
      <Route path="/jobs/:id/applicants" element={<Protected><Applicants /></Protected>} />
    </Routes>
  );
}