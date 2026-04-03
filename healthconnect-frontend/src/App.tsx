import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import PharmacyDashboard from './components/PharmacyDashboard';
import AdminPanel from './components/AdminPanel';
import PublicPages from './components/PublicPages';
import Login from './components/Login';
import ProfileCompletion from './components/ProfileCompletion';
import { AuthProvider } from './contexts/AuthContext';

export type UserRole = 'patient' | 'doctor' | 'pharmacy' | 'admin' | 'unknown';
export type CurrentView =
  | 'landing'
  | 'login-patient'
  | 'login-doctor'
  | 'login-pharmacy'
  | 'login-admin'
  | 'profile-completion'
  | 'dashboard'
  | 'public'
  | 'admin';

const roleRoutes: Record<Exclude<UserRole, 'unknown'>, string> = {
  patient: '/patient/home',
  doctor: '/doctor/dashboard',
  pharmacy: '/pharmacy/dashboard',
  admin: '/admin/dashboard',
};

function App() {
  const [userRole, setUserRole] = useState<UserRole>('unknown');
  const [currentView, setCurrentView] = useState<CurrentView>('landing');
  const [publicPage, setPublicPage] = useState<string>('about');
  const [pendingNewUser, setPendingNewUser] = useState<any>(null);

  const applyRoleRedirect = (role: UserRole) => {
    if (role === 'unknown') return;

    const path = roleRoutes[role as Exclude<UserRole, 'unknown'>];
    if (path && window.location.pathname !== path) {
      window.history.replaceState({}, '', path);
    }

    if (role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('dashboard');
    }
  };

  // Restore session from localStorage on app load
  useEffect(() => {
    const restoreSession = () => {
      try {
        const token = localStorage.getItem('token');
        const storedRole = localStorage.getItem('role') as UserRole | null;
        const pendingRaw = sessionStorage.getItem('pending_new_user');

        if (pendingRaw && window.location.pathname === '/complete-profile') {
          const pending = JSON.parse(pendingRaw);
          setPendingNewUser(pending);
          setCurrentView('profile-completion');
          return;
        }

        if (token && storedRole && storedRole !== 'unknown') {
          setUserRole(storedRole);
          applyRoleRedirect(storedRole);
        }
      } catch (err) {
        console.warn('[App] Failed to restore session:', err);
        // Clear corrupted data
        localStorage.removeItem('token');
        localStorage.removeItem('role');
      }
    };

    // Restore on initial load
    restoreSession();

    // Listen for user-updated events (for same-window updates)
    const handleUserUpdated = (event: Event) => {
      if (event instanceof CustomEvent) {
        const userData = event.detail;
        if (!userData || typeof userData !== 'object') {
          return;
        }
        const role = (userData.role || 'unknown') as UserRole;
        
        console.log('[App] User updated event:', userData.email);
        if (role && role !== 'unknown') {
          setUserRole(role);
          if (currentView.startsWith('login-') || currentView === 'profile-completion') {
            applyRoleRedirect(role);
          }
        }
      }
    };

    window.addEventListener('user-updated', handleUserUpdated);

    return () => {
      window.removeEventListener('user-updated', handleUserUpdated);
    };
  }, [currentView]);

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
    applyRoleRedirect(role);
  };

  const handleProfileCompletion = (userData: any) => {
    const role = (userData.role || 'patient') as UserRole;
    setUserRole(role);
    setPendingNewUser(null);
    sessionStorage.removeItem('pending_new_user');
    applyRoleRedirect(role);
  };

  const handleNewUserRedirect = (newUserData: any) => {
    console.log('[App] New user detected, redirecting to profile completion');
    setPendingNewUser(newUserData);
    sessionStorage.setItem('pending_new_user', JSON.stringify(newUserData));
    if (window.location.pathname !== '/complete-profile') {
      window.history.replaceState({}, '', '/complete-profile');
    }
    setCurrentView('profile-completion');
  };

  const handleLogout = () => {
    console.log('[App] Logout triggered');
    // Clear session data
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    sessionStorage.removeItem('pending_new_user');
    
    // Reset state
    setUserRole('unknown');
    window.history.replaceState({}, '', '/');
    setCurrentView('landing');
  };

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
            onNewUser={handleNewUserRedirect}
            onBack={() => setCurrentView('landing')}
          />
        );
      case 'login-doctor':
        return (
          <Login
            role="doctor"
            onLogin={handleLogin}
            onNewUser={handleNewUserRedirect}
            onBack={() => setCurrentView('landing')}
          />
        );
      case 'login-pharmacy':
        return (
          <Login
            role="pharmacy"
            onLogin={handleLogin}
            onNewUser={handleNewUserRedirect}
            onBack={() => setCurrentView('landing')}
          />
        );
      case 'login-admin':
        return (
          <Login
            role="admin"
            onLogin={handleLogin}
            onNewUser={handleNewUserRedirect}
            onBack={() => setCurrentView('landing')}
          />
        );

      // Profile Completion for new users
      case 'profile-completion':
        if (pendingNewUser) {
          return (
            <ProfileCompletion
              user={pendingNewUser}
              onComplete={handleProfileCompletion}
            />
          );
        }
        return (
          <LandingPage
            onNavigate={setCurrentView}
            onPublicNavigate={navigateToPublic}
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
