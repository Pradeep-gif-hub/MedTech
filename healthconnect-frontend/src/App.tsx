import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import PharmacyDashboard from './components/PharmacyDashboard';
import AdminPanel from './components/AdminPanel';
import PublicPages from './components/PublicPages';
import Login from './components/Login';
import ProfileCompletion from './components/ProfileCompletion';
import ResetPassword from './components/ResetPassword';
import ChatbotPage from './pages/ChatbotPage';
import { AuthProvider } from './contexts/AuthContext';

export type UserRole = 'patient' | 'doctor' | 'pharmacy' | 'admin' | 'unknown';
export type CurrentView =
  | 'landing'
  | 'login-patient'
  | 'login-doctor'
  | 'login-pharmacy'
  | 'login-admin'
  | 'profile-completion'
  | 'reset-password'
  | 'dashboard'
  | 'chatbot'
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
  const [loginNotice, setLoginNotice] = useState<string>('');

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
        const currentPath = window.location.pathname;
        const searchParams = new URLSearchParams(window.location.search);

        // CRITICAL: Don't reset view if user is in chatbot (preserves navigation)
        if (currentPath === '/chatbot') {
          console.log('[App] User in chatbot path, skipping session restore redirect');
          return;
        }

        if (currentPath === '/reset-password') {
          setCurrentView('reset-password');
          return;
        }

        if (pendingRaw && currentPath === '/complete-profile') {
          const pending = JSON.parse(pendingRaw);
          setPendingNewUser(pending);
          setCurrentView('profile-completion');
          return;
        }

        if (token && storedRole && storedRole !== 'unknown') {
          setUserRole(storedRole);
          applyRoleRedirect(storedRole);
          setLoginNotice('');
          return;
        }

        if (currentPath === '/login') {
          setLoginNotice(searchParams.get('message') || '');
          setCurrentView('login-patient');
          return;
        }

        setLoginNotice('');
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

  const handleNavigateToChatbot = () => {
    console.log('[App] Navigating to chatbot...');
    console.log('[App] Current URL:', window.location.pathname);
    console.log('[App] User role:', userRole);
    setCurrentView('chatbot');
    if (window.location.pathname !== '/chatbot') {
      console.log('[App] Updating URL to /chatbot');
      window.history.pushState({}, '', '/chatbot');
    }
    console.log('[App] ✅ Chatbot navigation complete');
  };

  const handleCloseChatbot = () => {
    console.log('[App] Closing chatbot, returning to dashboard');
    setCurrentView('dashboard');
    // Navigate back to patient home
    const targetPath = '/patient/home';
    if (window.location.pathname !== targetPath) {
      console.log('[App] Updating URL to', targetPath);
      window.history.pushState({}, '', targetPath);
    }
    console.log('[App] ✅ Chatbot closed, back to dashboard');
  };

  const renderContent = () => {
    switch (currentView) {
      // Login pages for each role
      case 'login-patient':
        return (
          <Login
            role="patient"
            noticeMessage={loginNotice}
            onLogin={handleLogin}
            onNewUser={handleNewUserRedirect}
            onBack={() => {
              setLoginNotice('');
              if (window.location.pathname !== '/') {
                window.history.replaceState({}, '', '/');
              }
              setCurrentView('landing');
            }}
          />
        );
      case 'login-doctor':
        return (
          <Login
            role="doctor"
            noticeMessage={loginNotice}
            onLogin={handleLogin}
            onNewUser={handleNewUserRedirect}
            onBack={() => {
              setLoginNotice('');
              if (window.location.pathname !== '/') {
                window.history.replaceState({}, '', '/');
              }
              setCurrentView('landing');
            }}
          />
        );
      case 'login-pharmacy':
        return (
          <Login
            role="pharmacy"
            noticeMessage={loginNotice}
            onLogin={handleLogin}
            onNewUser={handleNewUserRedirect}
            onBack={() => {
              setLoginNotice('');
              if (window.location.pathname !== '/') {
                window.history.replaceState({}, '', '/');
              }
              setCurrentView('landing');
            }}
          />
        );
      case 'login-admin':
        return (
          <Login
            role="admin"
            noticeMessage={loginNotice}
            onLogin={handleLogin}
            onNewUser={handleNewUserRedirect}
            onBack={() => {
              setLoginNotice('');
              if (window.location.pathname !== '/') {
                window.history.replaceState({}, '', '/');
              }
              setCurrentView('landing');
            }}
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

      case 'reset-password':
        return (
          <ResetPassword
            onBackToLogin={() => {
              if (window.location.pathname !== '/') {
                window.history.replaceState({}, '', '/');
              }
              setCurrentView('login-patient');
            }}
          />
        );

      // Dashboards
      case 'dashboard':
        switch (userRole) {
          case 'patient':
            return <PatientDashboard onLogout={handleLogout} onNavigateToChatbot={handleNavigateToChatbot} />;
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

      case 'chatbot':
        return <ChatbotPage onClose={handleCloseChatbot} />;

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
