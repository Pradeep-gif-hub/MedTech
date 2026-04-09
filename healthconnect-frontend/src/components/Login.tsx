import { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, Users, Activity, Pill, Shield, CheckCircle, Mail } from 'lucide-react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { UserRole } from '../App';
import { useAuth } from '../contexts/AuthContext';
import { buildApiUrl } from '../config/api';

interface LoginProps {
  onBack: () => void;
  role?: UserRole;
  onLogin: (role: UserRole) => void;
  onNewUser?: (userData: any) => void;
}

// Removed demo credentials - users must enter their own email and password

const roleRoutes: Record<Exclude<UserRole, 'unknown'>, string> = {
  patient: '/patient/home',
  doctor: '/doctor/dashboard',
  pharmacy: '/pharmacy/dashboard',
  admin: '/admin/dashboard',
};

const Login = ({ onBack, role = 'patient', onLogin, onNewUser }: LoginProps) => {
  // Auth hook for Google login
  const { setToken, setUser } = useAuth();
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [fullname, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setSelectgender] = useState('');
  const [bloodgroup, setShowBg] = useState('');
  const [allergy, setAllergy] = useState('');
  const [selectedRole, setSelectedRole]: [UserRole, (value: UserRole) => void] = useState(role ?? 'patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPasswordStep, setForgotPasswordStep] = useState('email' as 'email' | 'reset' | 'success');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Signup flow state
  const [signUpStep, setSignUpStep] = useState('form' as 'form' | 'otpSent' | 'setPassword' | 'success');
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpError, setOtpError] = useState(null as string | null);
  const [signUpMessage, setSignUpMessage] = useState(null as string | null);

  const roleData: Record<UserRole, { title: string; description: string; icon: JSX.Element; bgColor: string }> = {
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

  const parseJsonSafe = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return {};
    }
  };

  const persistSession = (token: string, role: UserRole) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);

    try {
      const ev = new CustomEvent('user-updated', { detail: { token, role } });
      window.dispatchEvent(ev);
    } catch (e) {
      console.warn('user-updated dispatch failed', e);
    }
  };

  const fetchCurrentUser = async (token: string) => {
    if (!token) return null;
    try {
      const res = await fetch(buildApiUrl('/api/users/me'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        return null;
      }

      return await res.json();
    } catch {
      return null;
    }
  };

  const redirectByRole = (role: UserRole) => {
    if (role === 'unknown') return;
    const route = roleRoutes[role as Exclude<UserRole, 'unknown'>];
    if (route) {
      window.history.replaceState({}, '', route);
    }
    onLogin(role);
  };

  const tryPost = async (endpoints: string[], payload: any) => {
    const paths = endpoints.map(e => buildApiUrl(e));
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
  const sendOtp = async (e?: any) => {
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

      const res = await fetch(buildApiUrl('/api/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseJsonSafe(res);
      
      if (res.ok) {
        setSignUpStep('otpSent');
        // Show debug OTP if provided by backend (development mode)
        if (data.debug_otp) {
          setSignUpMessage(`Development mode: Use OTP ${data.debug_otp}`);
        } else {
          setSignUpMessage('OTP has been sent to your email. Please check your inbox and spam folder.');
        }
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
  const verifyOtp = async (e?: any) => {
    if (e) e.preventDefault();
    setOtpError(null);
    try {
      const payload = { 
        email, 
        otp 
      };

      const res = await fetch(buildApiUrl('/api/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseJsonSafe(res);

      if (res.ok && data.verified) {
        setSignUpStep('setPassword');
        setOtpError(null);
        setSignUpMessage('OTP verified successfully. Please set your password.');
      } else {
        const message = data.message || 'Invalid or expired OTP';
        setOtpError(message);
        console.error('OTP verification failed:', data);
        // If there's a specific error about expiration, offer to resend
        if (message.toLowerCase().includes('expire')) {
          setSignUpMessage('OTP has expired. Please click "Resend OTP" to get a new one.');
        }
      }
    } catch (err) {
      console.error('Verify OTP failed:', err);
      setOtpError('Network error. Please try again.');
    }
  };

  // Complete signup (try /api/users/signup then /users/signup)
  const completeSignup = async (e?: any) => {
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

  // Google Auth - handles both login and signup
  const handleGoogleAuth = async (credential: string, isSignUp: boolean = false) => {
    try {
      // Send the Google ID token to the dedicated Google login endpoint
      const res = await fetch(buildApiUrl('/api/users/google-login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credential}`
        },
        body: JSON.stringify({ 
          role: selectedRole
        })
      });

      if (res.ok) {
        const response = await parseJsonSafe(res);
        const { user, is_new_user } = response;
        
        // Store Google identity in memory only.
        setUser({
          google_id: user.google_id || '',
          email: user.email || '',
          name: user.name,
          picture: user.picture,
          email_verified: user.email_verified
        });

        if (is_new_user) {
          // New user - redirect to profile completion
          console.log('[Login] New user detected, redirecting to profile completion');
          if (onNewUser) {
            onNewUser({
              ...user,
              role: user.role || selectedRole,
              picture: user.picture || user.profile_picture_url || ''
            });
          }
        } else {
          // Existing user - login directly
          const appToken = response.token || user.token || '';
          if (!appToken) {
            alert('Google login failed: missing session token');
            return;
          }
          const resolvedRole = (user.role || selectedRole) as UserRole;

          persistSession(appToken, resolvedRole);
          if (appToken) {
            setToken(appToken);
          }

          const hydratedProfile = await fetchCurrentUser(appToken);
          const nextRole = (hydratedProfile?.role || resolvedRole) as UserRole;
          if (hydratedProfile) {
            window.dispatchEvent(new CustomEvent('user-updated', { detail: hydratedProfile }));
          }

          setLoggedIn(true);
          redirectByRole(nextRole);
        }
      } else {
        const error = await extractError(res);
        if (isSignUp) {
          alert(`Google sign up failed: ${error}`);
        } else {
          alert(`Google login failed: ${error}`);
        }
      }
    } catch (error) {
      console.error('Google auth error:', error);
      if (isSignUp) {
        alert('Google sign up failed. Please check your internet connection and try again.');
      } else {
        alert('Google login failed. Please check your internet connection and try again.');
      }
    }
  };

  // Handle Google Login response
  const handleGoogleLoginSuccess = (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      handleGoogleAuth(credentialResponse.credential, false);
    }
  };

  // Handle Google Signup response
  const handleGoogleSignupSuccess = (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      handleGoogleAuth(credentialResponse.credential, true);
    }
  };

  const handleGoogleError = () => {
    alert('Google login failed. Please try again.');
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    try {
      // Truncate password to 72 bytes as per bcrypt requirement
      const truncatedPassword = password.slice(0, 72);
      const res = await tryPost(['/api/users/login', '/users/login'], { email, password: truncatedPassword });
      if (res.ok) {
        const data = await parseJsonSafe(res);
        const appToken = data.token || '';
        if (!appToken) {
          alert('Login failed: missing session token');
          return;
        }
        const resolvedRole = (data.role || selectedRole) as UserRole;

        persistSession(appToken, resolvedRole);
        if (appToken) {
          setToken(appToken);
        }

        const hydratedProfile = await fetchCurrentUser(appToken);
        const nextRole = (hydratedProfile?.role || resolvedRole) as UserRole;
        if (hydratedProfile) {
          window.dispatchEvent(new CustomEvent('user-updated', { detail: hydratedProfile }));
        }

        setLoggedIn(true);
        redirectByRole(nextRole);
      } else {
        const err = await extractError(res);
        alert(`Login failed: ${err}`);
      }
    } catch (err) {
      console.error(err);
      alert('Login failed. Check backend and CORS.');
    }
  };

  const handleForgotPasswordRequest = async (e: any) => {
    e.preventDefault();
    setIsSendingReset(true);
    setForgotPasswordMessage('');
    try {
      const res = await tryPost(
        ['/api/auth/forgot-password', '/auth/forgot-password', '/api/users/forgot-password'],
        { email: forgotEmail }
      );

      const data: any = await parseJsonSafe(res);

      if ((res.ok || res.status === 200) && data?.success !== false) {
        setForgotPasswordStep('success');
        setForgotPasswordMessage(data.detail || 'Check your inbox for the reset link');
      } else {
        setForgotPasswordMessage(data.detail || data.message || 'Failed to send reset link. Please try again.');
        setForgotPasswordStep('email');
      }
    } catch (err) {
      console.error(err);
      setForgotPasswordMessage('Network error. Please check your connection and try again.');
      setForgotPasswordStep('email');
    } finally {
      setIsSendingReset(false);
    }
  };

 if (loggedIn) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      {showForgotPassword ? (
        // Forgot Password Layout - Left aligned
        <div className="max-w-md w-full bg-emerald-50 rounded-2xl shadow-xl p-8">
          <button 
            onClick={onBack} 
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Home</span>
          </button>

            {forgotPasswordStep === 'email' && (
              <form onSubmit={handleForgotPasswordRequest} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h2>
                  <p className="text-gray-600 text-sm">We'll help you reset it</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input 
                      type="email" 
                      placeholder="Enter the email address associated with your MedTech account." 
                      value={forgotEmail} 
                      onChange={(e) => setForgotEmail(e.target.value)} 
                      className="w-full px-4 py-3 pl-10 border rounded-lg text-sm placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" 
                      required 
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">We'll send a password reset link to this email address.</p>
                </div>

                {forgotPasswordMessage && (
                  <div className="p-4 bg-red-50 rounded-lg text-red-800 text-sm border border-red-200">
                    <p><strong>⚠️ Error:</strong> {forgotPasswordMessage}</p>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isSendingReset} 
                  className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${roleData[selectedRole].bgColor} hover:opacity-90 transition disabled:opacity-50`}
                >
                  {isSendingReset ? 'Sending Reset Link...' : 'Send Reset Link'}
                </button>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-sm">
                    <span className="font-semibold">💡 Tip:</span> Make sure to check your email's spam folder if you don't see the reset link within a few minutes.
                  </p>
                </div>

                <p className="text-center text-sm text-gray-600">
                  Remember your password? <button 
                    type="button" 
                    onClick={() => { setShowForgotPassword(false); setForgotPasswordStep('email'); }} 
                    className="text-emerald-600 font-medium hover:underline"
                  >
                    Back to Login
                  </button>
                </p>
              </form>
            )}

            {forgotPasswordStep === 'success' && (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-emerald-600" />
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-gray-900 text-center">Check Your Email</h3>
                  <p className="text-gray-600 text-sm text-center mt-2">We've sent a password reset link to</p>
                </div>

                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                  <p className="text-emerald-800 font-medium text-sm text-center">{forgotEmail}</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-xs text-center">
                    The link will expire in <strong>1 hour</strong>. Check your inbox and spam folder.
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-xs text-center">
                    <strong>⚠️ Security:</strong> Don't share the link with anyone.
                  </p>
                </div>

                <button 
                  onClick={() => { setShowForgotPassword(false); setForgotPasswordStep('email'); }} 
                  className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${roleData[selectedRole].bgColor}`}
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        ) : (
          // Normal Login/Signup Layout - Centered
          <div className="max-w-md w-full bg-emerald-50 rounded-2xl shadow-xl p-8">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Home</span>
            </button>

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
                        placeholder="Enter your email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        className="w-full px-4 py-3 border rounded-lg text-sm placeholder:text-sm" 
                        required 
                      />
                    </div>

                    <div>
                      <label className="block text-base font-medium text-gray-700 mb-2">Password</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? 'text' : 'password'} 
                          placeholder="Enter your password" 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          className="w-full px-4 py-3 border rounded-lg pr-12 text-sm placeholder:text-sm" 
                          required 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)} 
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
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
                        {isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
                      </button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-emerald-50 text-gray-500">Or sign up with</span>
                        </div>
                      </div>

                      <div className="w-full">
                        <GoogleLogin
                          onSuccess={handleGoogleSignupSuccess}
                          onError={handleGoogleError}
                          text="signup_with"
                          theme="outline"
                        />
                      </div>

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
                  <input 
                    type="email" 
                    placeholder="Enter your email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full px-4 py-3 border rounded-lg text-sm placeholder:text-sm" 
                    required 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="Enter your password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      className="w-full px-4 py-3 border rounded-lg pr-12 text-sm placeholder:text-sm" 
                      required 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button type="submit" className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${roleData[selectedRole].bgColor}`}>Sign In</button>

                <button 
                  type="button" 
                  onClick={() => setShowForgotPassword(true)} 
                  className="text-left py-2 text-sm text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
                >
                  Forgot Password?
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-emerald-50 text-gray-500">Or continue with</span>
                  </div>
                </div>

                <div className="w-full">
                  <GoogleLogin
                    onSuccess={handleGoogleLoginSuccess}
                    onError={handleGoogleError}
                    text="signin"
                    theme="outline"
                  />
                </div>

                <p className="text-sm text-gray-600 mt-4 text-center">
                  Don't have an account? <button type="button" onClick={() => setShowSignUp(true)} className="text-emerald-600 font-medium">Sign Up</button>
                </p>
              </form>
            )}
          </div>
        )}
    </div>
  );
};

export default Login;
