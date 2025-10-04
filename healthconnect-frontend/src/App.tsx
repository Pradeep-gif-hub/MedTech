import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import PharmacyDashboard from './components/PharmacyDashboard';
import AdminPanel from './components/AdminPanel';
import PublicPages from './components/PublicPages';
import Login from './components/Login';
import { AuthProvider } from './contexts/AuthContext';

export type UserRole = 'patient' | 'doctor' | 'pharmacy' | 'admin' | 'unknown';
export type CurrentView =
  | 'landing'
  | 'login-patient'
  | 'login-doctor'
  | 'login-pharmacy'
  | 'login-admin'
  | 'dashboard'
  | 'public'
  | 'admin';

function App() {
  const [userRole, setUserRole] = useState<UserRole>('unknown');
  const [currentView, setCurrentView] = useState<CurrentView>('landing');
  const [publicPage, setPublicPage] = useState<string>('about');

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
    if (role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleLogout = () => {
    setUserRole('unknown');
    setCurrentView('landing');
  }

  const navigateToPublic = (page: string) => {
    setPublicPage(page);
    setCurrentView('public');
  };

  const renderContent = () => {
    switch (currentView) {
      // Login pages for each role
      case 'login-patient':
        return (
          <Login
            role="patient"
            onLogin={handleLogin}
            onBack={() => setCurrentView('landing')}
          />
        );
      case 'login-doctor':
        return (
          <Login
            role="doctor"
            onLogin={handleLogin}
            onBack={() => setCurrentView('landing')}
          />
        );
      case 'login-pharmacy':
        return (
          <Login
            role="pharmacy"
            onLogin={handleLogin}
            onBack={() => setCurrentView('landing')}
          />
        );
      case 'login-admin':
        return (
          <Login
            role="admin"
            onLogin={handleLogin}
            onBack={() => setCurrentView('landing')}
          />
        );

      // Dashboards
      case 'dashboard':
        switch (userRole) {
          case 'patient':
            return <PatientDashboard onLogout={handleLogout} />;
          case 'doctor':
            return <DoctorDashboard onLogout={handleLogout} />;
          case 'pharmacy':
            return <PharmacyDashboard onLogout={handleLogout} />;
          default:
            return (
              <LandingPage
                onNavigate={setCurrentView}
                onPublicNavigate={navigateToPublic}
              />
            );
        }

      case 'admin':
        return <AdminPanel onLogout={handleLogout} />;

      case 'public':
        return (
          <PublicPages
            page={publicPage}
            onNavigate={setCurrentView}
            onPublicNavigate={navigateToPublic}
          />
        );

      default:
        return (
          <LandingPage
            onNavigate={setCurrentView}
            onPublicNavigate={navigateToPublic}
          />
        );
    }
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">{renderContent()}</div>
    </AuthProvider>
  );
}

export default App;
