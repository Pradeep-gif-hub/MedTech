import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, Users, Activity, Pill, Shield } from 'lucide-react';
import { UserRole } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebaseConfig';

interface LoginProps {
  onBack: () => void;
  role?: UserRole;
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
  // Auth hook for Google login
  const { setToken } = useAuth();
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [fullname, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setSelectgender] = useState('');
  const [bloodgroup, setShowBg] = useState('');
  const [allergy, setAllergy] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(role ?? 'patient');
  const [email, setEmail] = useState(demoCredentials[role ?? 'patient'].email);
  const [password, setPassword] = useState(demoCredentials[role ?? 'patient'].password);
  const [loggedIn, setLoggedIn] = useState(false);

  // Signup flow state
  const [signUpStep, setSignUpStep] = useState<'form' | 'otpSent' | 'setPassword' | 'success'>('form');
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [signUpMessage, setSignUpMessage] = useState<string | null>(null);

  const roleData: Record<UserRole | 'unknown', { title: string; description: string; icon: JSX.Element; bgColor: string }> = {
    patient: { title: 'Patient', description: 'Access consultations and health records', icon: <Users className="h-6 w-6 text-white" />, bgColor: 'bg-blue-600' },
    doctor: { title: 'Doctor', description: 'Manage consultations and patient care', icon: <Activity className="h-6 w-6 text-white" />, bgColor: 'bg-green-600' },
    pharmacy: { title: 'Pharmacy', description: 'Manage prescriptions and medicines', icon: <Pill className="h-6 w-6 text-white" />, bgColor: 'bg-purple-600' },
    admin: { title: 'Admin', description: 'Control system-wide settings', icon: <Shield className="h-6 w-6 text-white" />, bgColor: 'bg-red-600' },
    unknown: { title: 'Unknown', description: '', icon: <Shield className="h-6 w-6 text-white" />, bgColor: 'bg-gray-600' },
  };

  const extractError = async (res: Response) => {
    try {
      const j = await res.json();
      if (j.detail) return typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      if (j.message) return j.message;
      return JSON.stringify(j);
    } catch {
      return `HTTP ${res.status}`;
    }
  };

  const saveUserData = (data: any, fallbackRole: UserRole) => {
    const userData = {
      token: data.token || '',
      name: data.name || '',
      age: data.age?.toString() || '',
      gender: data.gender || '',
      bloodgroup: data.bloodgroup || '',
      allergy: data.allergy || '',
      role: data.role || fallbackRole,
      user_id: data.user_id?.toString() || '',
      email: data.email || email || ''
    };
    localStorage.setItem('user', JSON.stringify(userData));

    // NEW: notify same-window listeners that user changed (useful because storage events don't fire in same window)
    try {
      const ev = new CustomEvent('user-updated', { detail: userData });
      window.dispatchEvent(ev);
    } catch (e) {
      // fallback: no-op
      console.warn('user-updated dispatch failed', e);
    }

    return userData;
  };

  const tryPost = async (paths: string[], payload: any) => {
    for (const p of paths) {
      try {
        const res = await fetch(p, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return res;
      } catch (e) {
        console.warn('Post failed', p, e);
        continue;
      }
    }
    throw new Error('No reachable endpoint');
  };

  // Send OTP - updated to match backend route
  const sendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      // Match the backend OTPRequest payload structure
      const payload = { 
        email,
        name: fullname, 
        role: selectedRole,
        // Optional fields
        age: age || undefined,
        gender: gender || undefined,
        bloodgroup: bloodgroup || undefined,
        allergy: allergy || undefined
      };

      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      
      if (res.ok) {
        setSignUpStep('otpSent');
        // Show debug OTP if provided by backend (development mode)
      } else {
        const err = await extractError(res);
        setOtpError(`Failed to send OTP: ${err}`);
      }
    } catch (err) {
      console.error('Send OTP failed:', err);
      setOtpError('Network error. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP - updated to match backend route
  const verifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setOtpError(null);
    try {
      const payload = { 
        email, 
        otp 
      };

      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.verified) {
        setSignUpStep('setPassword');
        setSignUpMessage('OTP verified successfully. Please set your password.');
      } else {
        const message = data.message || 'Invalid or expired OTP';
        setOtpError(message);
      }
    } catch (err) {
      console.error('Verify OTP failed:', err);
      setOtpError('Network error. Please try again.');
    }
  };

  // Complete signup (try /api/users/signup then /users/signup)
  const completeSignup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const payload = { name: fullname, age, gender, bloodgroup, allergy, email, password, role: selectedRole };
      const res = await tryPost(['/api/users/signup', '/users/signup'], payload);
      if (res.ok) {
        setSignUpStep('success');
        setSignUpMessage('Sign up successful! You may now go back to Login to sign in.');
      } else {
        const err = await extractError(res);
        alert(`Sign up failed: ${res.status} ${res.statusText} — ${err}`);
      }
    } catch (err) {
      console.error(err);
      alert('Sign up failed. Check backend and network.');
    }
  };

  // Login (try both prefixes)
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      
      // Send the token to your backend
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          googleToken: idToken,
          role: selectedRole
        })
      });

      if (res.ok) {
        const data = await res.json();
        setToken(idToken); // Update auth context
        const userData = saveUserData(data, selectedRole);
        setLoggedIn(true);
        onLogin(userData.role);
      } else {
        const error = await extractError(res);
        alert(`Google login failed: ${error}`);
      }
    } catch (error) {
      console.error('Google login error:', error);
      alert('Google login failed. Please try again.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await tryPost(['/api/users/login', '/users/login'], { email, password });
      if (res.ok) {
        const data = await res.json();
        const userData = saveUserData(data, selectedRole);
        setLoggedIn(true);
        onLogin(userData.role);
      } else {
        const err = await extractError(res);
        alert(`Login failed: ${err}`);
      }
    } catch (err) {
      console.error(err);
      alert('Login failed. Check backend and CORS.');
    }
  };

 if (loggedIn) return null;

return (
  <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-emerald-50 rounded-2xl shadow-xl p-8"> 
      <button 
        onClick={onBack} 
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Home</span>
      </button>

      <div className="flex items-center space-x-3 mb-8">
        <div className={`w-10 h-12 rounded-lg ${roleData[selectedRole].bgColor} flex items-center justify-center`}>
          {roleData[selectedRole].icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {roleData[selectedRole].title} {showSignUp ? 'Sign Up' : 'Login'}
          </h1>
          <p className="text-gray-600">{roleData[selectedRole].description}</p>
        </div>
      </div>

      {showSignUp ? (
        <>
          {signUpStep === 'form' && (
            <form onSubmit={sendOtp} className="space-y-4">
              
              <div>
                <label className="block text-base font-medium text-gray-800 mb-2">Full Name</label>
                <input 
                  type="text" 
                  placeholder="Enter Your Name" 
                  value={fullname} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full px-4 py-3 border rounded-lg text-sm placeholder:text-sm" 
                  required 
                />
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">Age</label>
                <select 
                  value={age} 
                  onChange={(e) => setAge(e.target.value)} 
                  className="w-full px-4 py-3 border rounded-lg text-sm" 
                  required
                >
                  <option value="">Select Your Age</option>
                  {Array.from({ length: 100 }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-1">Gender</label>
                <select 
                  value={gender} 
                  onChange={e => setSelectgender(e.target.value)} 
                  className="w-full px-2 py-2 border rounded-lg text-sm" 
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="transgender">Transgender</option>
                  <option value="other">Rather Not to Say</option>
                </select>
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">Blood Group</label>
                <select 
                  value={bloodgroup} 
                  onChange={e => setShowBg(e.target.value)} 
                  className="w-full px-2 py-2 border rounded-lg text-sm" 
                  required
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="B+">B+</option>
                  <option value="AB+">AB+</option>
                  <option value="O+">O+</option>
                </select>
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">Allergy</label>
                <input 
                  type="text" 
                  placeholder="Any Allergy/Null" 
                  value={allergy} 
                  onChange={(e) => setAllergy(e.target.value)} 
                  className="w-full px-4 py-3 border rounded-lg text-sm placeholder:text-sm" 
                />
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full px-4 py-3 border rounded-lg text-sm placeholder:text-sm" 
                  required 
                />
              </div>

              <div>
                <label className="block text-base font-medium text-gray-700 mb-2">Role</label>
                <select 
                  value={selectedRole} 
                  onChange={e => setSelectedRole(e.target.value as UserRole)} 
                  className="w-full px-2 py-2 border rounded-lg text-sm" 
                  required
                >
                  <option value="">Select Role</option>
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <button 
                  type="submit" 
                  disabled={isSendingOtp} 
                  className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${roleData[selectedRole].bgColor}`}
                >
                  {isSendingOtp ? 'Send OTP' : 'Send OTP'}
                </button>

                <p className="text-base text-gray-600 mt-4 text-center">
                  Already have an account? 
                  <button 
                    type="button" 
                    onClick={() => { setShowSignUp(false); setSignUpStep('form'); }} 
                    className="text-emerald-600 font-medium"
                  >
                    Login
                  </button>
                </p>
              </div>
            </form>
          )}

            {signUpStep === 'otpSent' && (
              <form onSubmit={verifyOtp} className="space-y-4">
                <div><p className="text-sm text-gray-700">{signUpMessage}</p></div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
                  <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full px-4 py-3 border rounded-lg" required />
                  {otpError && <p className="text-xs text-red-500 mt-1">{otpError}</p>}
                </div>

                <div className="flex gap-2">
                  <button type="submit" className={`flex-1 py-3 px-4 rounded-lg text-white font-semibold ${roleData[selectedRole].bgColor}`}>Verify OTP</button>
                  <button type="button" onClick={sendOtp} className="flex-1 py-3 px-4 rounded-lg border">Resend OTP</button>
                </div>
              </form>
            )}

            {signUpStep === 'setPassword' && (
              <form onSubmit={completeSignup} className="space-y-4">
                <div><p className="text-sm text-gray-700">{signUpMessage}</p></div>

                <div>
                  <label className="block text-lm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg pr-12" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button type="submit" className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${roleData[selectedRole].bgColor}`}>Complete Sign Up</button>
              </form>
            )}

            {signUpStep === 'success' && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg text-green-800">
                  <p className="font-semibold">Sign up successful</p>
                  <p className="text-sm mt-1">{signUpMessage}</p>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => { setShowSignUp(false); setSignUpStep('form'); }} className="flex-1 py-3 px-4 rounded-lg border">Back to Login</button>
                </div>
              </div>
            )}
          </>
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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-emerald-50 text-gray-500">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Sign in with Google
            </button>

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
