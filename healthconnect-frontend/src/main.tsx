import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import App from './App.tsx';
import ResetPassword from './components/ResetPassword.tsx';
import { GOOGLE_CLIENT_ID } from './firebaseConfig.ts';
import './index.css';

const ResetPasswordRoute = () => {
  const navigate = useNavigate();

  return (
    <ResetPassword
      onBackToLogin={() => {
        navigate('/login', { replace: true });
      }}
    />
  );
};

createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <BrowserRouter>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordRoute />} />
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </GoogleOAuthProvider>
);
