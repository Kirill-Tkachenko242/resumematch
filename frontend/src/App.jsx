import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Resumes from './pages/Resumes';
import { getToken } from './api';

function Protected({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth />} />
      <Route path="/resumes" element={<Protected><Resumes /></Protected>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}