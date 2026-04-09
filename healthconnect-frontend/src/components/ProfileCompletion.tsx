import { useState } from 'react';
import { buildApiUrl } from '../config/api';

interface ProfileCompletionProps {
  user: {
    user_id?: number;
    email: string;
    name: string;
    picture?: string;
    role?: 'patient' | 'doctor' | 'pharmacy' | 'admin';
  };
  onComplete: (userData: any) => void;
}

type ProfileFormData = {
  name: string;
  dob: string;
  phone: string;
  gender: string;
  bloodgroup: string;
  allergy: string;
  password: string;
  role: 'patient' | 'doctor' | 'pharmacy' | 'admin';
};

const ProfileCompletion = ({ user, onComplete }: ProfileCompletionProps) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    dob: '',
    phone: '',
    gender: '',
    bloodgroup: '',
    allergy: '',
    password: '',
    role: (user.role || 'patient') as 'patient' | 'doctor' | 'pharmacy' | 'admin'
  } as ProfileFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);

  const computeAgeFromDob = (dob: string) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  };

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev: ProfileFormData) => ({
      ...prev,
      [name]: value
    } as ProfileFormData));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const age = computeAgeFromDob(formData.dob);
      const payload = {
        user_id: user.user_id,
        name: formData.name,
        email: user.email,
        role: formData.role,
        dob: formData.dob,
        phone: formData.phone,
        age,
        gender: formData.gender,
        bloodgroup: formData.bloodgroup,
        allergy: formData.allergy,
        password: formData.password,
        picture: user.picture || '',
        profile_picture_url: user.picture || ''
      };

      const res = await fetch(buildApiUrl('/api/users/complete-profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (res.ok) {
        const userData = {
          token: data.token || `local:${data.user_id}`,
          user_id: data.user_id,
          id: data.id,
          email: data.email || user.email,
          name: data.name || formData.name,
          age: data.age?.toString() || '',
          dob: data.dob || '',
          phone: data.phone || '',
          gender: data.gender || '',
          bloodgroup: data.bloodgroup || '',
          allergy: data.allergy || '',
          role: data.role || formData.role,
          profile_picture_url: data.profile_picture_url,
          picture: data.picture || data.profile_picture_url || user.picture || ''
        };

        // Save minimal session keys only.
        localStorage.setItem('token', userData.token);
        localStorage.setItem('role', userData.role);

        // Dispatch custom event for same-window listeners
        const ev = new CustomEvent('user-updated', { detail: userData });
        window.dispatchEvent(ev);

        // Call completion handler; App manages role-based dashboard routing.
        onComplete(userData);
      } else {
        setError(data.detail || data.message || 'Failed to complete profile');
      }
    } catch (err) {
      console.error('Profile completion error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-600 mt-2">Welcome to MedTech! Please provide your information to get started.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="Enter your full name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Date of Birth *
            </label>
            <input
              type="date"
              name="dob"
              value={formData.dob}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              required
              placeholder="Enter your phone number"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Gender *
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Blood Group */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Blood Group *
            </label>
            <select
              name="bloodgroup"
              value={formData.bloodgroup}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Select Blood Group</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Allergies
            </label>
            <input
              type="text"
              name="allergy"
              value={formData.allergy}
              onChange={handleInputChange}
              placeholder="Enter any allergies (optional)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Create a strong password"
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Completing Profile...' : 'Complete Profile & Continue'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-4">
          We'll use this information to personalize your experience
        </p>
      </div>
    </div>
  );
};

export default ProfileCompletion;
