import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildApiUrl } from '../config/api';

interface ResetPasswordProps {
  onBackToLogin?: () => void;
}

const ResetPassword = ({ onBackToLogin }: ResetPasswordProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const email = (query.get('email') || '').trim();
  const token = (query.get('token') || '').trim();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messageTone, setMessageTone] = useState('error' as 'error' | 'success');
  const [message, setMessage] = useState('');
  const hasResetParams = Boolean(email && token);

  const goToLogin = () => {
    if (onBackToLogin) {
      onBackToLogin();
      return;
    }
    navigate('/login', { replace: true });
  };

  const parseJsonSafe = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return {};
    }
  };

  const postResetWithFallback = async (payload: { token: string; email: string; new_password: string }): Promise<Response> => {
    const endpoints = ['/api/auth/reset-password', '/auth/reset-password', '/api/users/reset-password'];
    let lastError: unknown = null;

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(buildApiUrl(endpoint), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return res;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('No reset endpoint reachable');
  };

  const resolveResetError = (data: any): string => {
    const errorCode = String(data?.error || '').toLowerCase();
    const errorText = String(data?.message || data?.detail || '').toLowerCase();

    if (errorCode.includes('token_expired') || errorText.includes('expired')) {
      return 'This reset link has expired. Please request a new one.';
    }

    if (errorCode.includes('invalid_token') || errorText.includes('invalid')) {
      return 'Reset link invalid or expired';
    }

    return data?.message || data?.detail || 'Failed to reset password. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');

    if (!hasResetParams) {
      setMessageTone('error');
      setMessage('Reset link invalid or expired');
      return;
    }

    if (!newPassword) {
      setMessageTone('error');
      setMessage('New password is required.');
      return;
    }

    if (newPassword.length < 8) {
      setMessageTone('error');
      setMessage('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessageTone('error');
      setMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await postResetWithFallback({
        email,
        token,
        new_password: newPassword,
      });

      const data = await parseJsonSafe(res);
      if ((res.ok || res.status === 200) && data?.success !== false) {
        const successMessage = 'Password updated successfully. Please login.';
        setMessageTone('success');
        setMessage(successMessage);

        window.setTimeout(() => {
          navigate(`/login?message=${encodeURIComponent(successMessage)}`, { replace: true });
        }, 700);
      } else {
        setMessageTone('error');
        setMessage(resolveResetError(data));
      }
    } catch (error) {
      console.error('[ResetPassword] request failed:', error);
      setMessageTone('error');
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="max-w-md w-full bg-emerald-50 rounded-2xl shadow-xl p-8">
        <button
          type="button"
          onClick={goToLogin}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Login</span>
        </button>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reset Your Password</h1>
            <p className="text-sm text-gray-600 mt-1">Enter and confirm your new password to secure your account.</p>
          </div>

          {!hasResetParams && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
              Reset link invalid or expired
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg border text-sm ${
                messageTone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !hasResetParams}
            className="w-full py-3 px-4 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {loading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
