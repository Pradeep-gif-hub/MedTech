import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, Users, Activity, Pill, Shield } from 'lucide-react';
import { UserRole } from '../App';

interface LoginProps {
  onBack: () => void;
  role?: UserRole; // optional; landing should pass selected role if available
  onLogin: (role: UserRole) => void;
}

const demoCredentials: Record<UserRole, { email: string; password: string }> = {
  patient: { email: 'pradeepka.ic.24@nitj.ac.in', password: 'Medtech' },
  doctor: { email: 'paarthl.ic.24@nitj', password: 'demo123' },
  pharmacy: { email: 'pharmacy@nitj.ac.in', password: 'demo123' },
  admin: { email: 'admin@nitj.ac.in', password: 'Admin' },
  unknown: { email: '', password: '' },
};

const Login: React.FC<LoginProps> = ({ onBack, role = 'patient', onLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(role ?? 'patient');
  const [email, setEmail] = useState(demoCredentials[role ?? 'patient'].email);
  const [password, setPassword] = useState(demoCredentials[role ?? 'patient'].password);
  const [loggedIn, setLoggedIn] = useState(false);

  const roleData: Record<UserRole | 'unknown', { title: string; description: string; icon: JSX.Element; bgColor: string }> = {
    patient: { title: 'Patient', description: 'Access consultations and health records', icon: <Users className="h-6 w-6 text-white" />, bgColor: 'bg-blue-600' },
    doctor: { title: 'Doctor', description: 'Manage consultations and patient care', icon: <Activity className="h-6 w-6 text-white" />, bgColor: 'bg-green-600' },
    pharmacy: { title: 'Pharmacy', description: 'Manage prescriptions and medicines', icon: <Pill className="h-6 w-6 text-white" />, bgColor: 'bg-purple-600' },
    admin: { title: 'Admin', description: 'Control system-wide settings', icon: <Shield className="h-6 w-6 text-white" />, bgColor: 'bg-red-600' },
    unknown: { title: 'Unknown', description: '', icon: <Shield className="h-6 w-6 text-white" />, bgColor: 'bg-gray-600' },
  };

  // Helper to parse server error detail
  const extractError = async (res: Response) => {
    try {
      const j = await res.json();
      if (j.detail) {
        if (typeof j.detail === 'string') return j.detail;
        if (Array.isArray(j.detail)) return j.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        return JSON.stringify(j.detail);
      }
      if (j.message) return j.message;
      return JSON.stringify(j);
    } catch (err) {
      return `HTTP ${res.status}`;
    }
  };

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
  const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // store token & user info
        localStorage.setItem('token', data.token || '');
        localStorage.setItem('name', data.name || '');
        localStorage.setItem('role', data.role || selectedRole);
        localStorage.setItem('user_id', data.user_id?.toString() || '');
        localStorage.setItem('email', email || '');

        setLoggedIn(true);
        onLogin(data.role || selectedRole);
      } else {
        const err = await extractError(res);
        alert(`Login failed: ${err}`);
      }
    } catch (err) {
      console.error(err);
      alert('Login failed. Check backend is running and CORS allows requests.');
    }
  };

  // Sign up -> then auto-login
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
  const res = await fetch('/api/users/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          role: selectedRole,
          allergies: '',
          medications: '',
          surgeries: ''
        }),
      });

      if (res.ok) {
        await res.json();
        // after signup, call login to get token & redirect
  const loginRes = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (loginRes.ok) {
          const loginData = await loginRes.json();
          localStorage.setItem('token', loginData.token || '');
          localStorage.setItem('name', loginData.name || '');
          localStorage.setItem('role', loginData.role || selectedRole);
          localStorage.setItem('user_id', loginData.user_id?.toString() || '');
          localStorage.setItem('email', email || '');
          setLoggedIn(true);
          onLogin(loginData.role || selectedRole);
        } else {
          const err = await extractError(loginRes);
          alert(`Registered but auto-login failed: ${err}`);
          setShowSignUp(false);
        }
      } else {
        const err = await extractError(res);
        alert(`Sign up failed: ${err}`);
      }
    } catch (err) {
      console.error(err);
      alert('Something went wrong. Check backend is running and CORS allows requests.');
    }
  };

  React.useEffect(() => {
    setSelectedRole(role ?? 'patient');
    setEmail(demoCredentials[role ?? 'patient'].email);
    setPassword(demoCredentials[role ?? 'patient'].password);
  }, [role]);

  // After login, App.tsx will handle dashboard rendering based on user role
  if (loggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <button onClick={onBack} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center space-x-3 mb-8">
          <div className={`w-12 h-12 rounded-lg ${roleData[selectedRole].bgColor} flex items-center justify-center`}>
            {roleData[selectedRole].icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{roleData[selectedRole].title} {showSignUp ? 'Sign Up' : 'Login'}</h1>
            <p className="text-gray-600">{roleData[selectedRole].description}</p>
          </div>
        </div>

        {showSignUp ? (
          <form onSubmit={handleSignUp} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border rounded-lg" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border rounded-lg" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg pr-12" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={selectedRole}
                onChange={e => {
                  const newRole = e.target.value as UserRole;
                  setSelectedRole(newRole);
                  setEmail(demoCredentials[newRole].email);
                  setPassword(demoCredentials[newRole].password);
                }}
                className="w-full px-4 py-3 border rounded-lg"
                required
              >
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button type="submit" className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${roleData[selectedRole].bgColor}`}>Sign Up</button>

            <p className="text-sm text-gray-600 mt-4 text-center">
              Already have an account? <button type="button" onClick={() => setShowSignUp(false)} className="text-emerald-600 font-medium">Login</button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border rounded-lg" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg pr-12" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button type="submit" className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${roleData[selectedRole].bgColor}`}>Sign In</button>

            <p className="text-sm text-gray-600 mt-4 text-center">
              Don't have an account? <button type="button" onClick={() => setShowSignUp(true)} className="text-emerald-600 font-medium">Sign Up</button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
