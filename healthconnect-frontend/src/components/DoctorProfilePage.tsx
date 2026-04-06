// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useBackendProfile, getAuthHeaders } from '../hooks/useBackendProfile';
import { buildApiUrl } from '../config/api';
import { ArrowLeft, Loader } from 'lucide-react';

interface DoctorProfilePageProps {
  onBack: () => void;
}

interface DoctorProfile {
  id: number;
  full_name: string;
  email: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
  specialization: string;
  years_of_experience: number;
  languages_spoken: string[];
  license_number: string;
  registration_number: string;
  hospital_name: string;
  profile_photo: string;
  abha_id: string;
  emergency_contact: string;
  license_status: string;
  license_valid_till: string;
  created_at: string;
  updated_at: string;
}

const DoctorProfilePage: React.FC<DoctorProfilePageProps> = ({ onBack }) => {
  const { profile, loading, error, refreshProfile } = useBackendProfile();

  // Professional Information State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState<number | ''>('');
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [licenseStatus, setLicenseStatus] = useState('');
  const [licenseValidTill, setLicenseValidTill] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');

  // UI State
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'personal' | 'professional' | 'credentials'>('personal');

  // Populate form from backend profile
  useEffect(() => {
    if (!profile) return;

    setFullName(profile.full_name || profile.name || '');
    setEmail(profile.email || '');
    setPhoneNumber(profile.phone || profile.phone_number || '');
    setDateOfBirth(profile.dob || profile.date_of_birth || '');
    setGender(profile.gender || '');
    setBloodGroup(profile.bloodgroup || profile.blood_group || '');
    setSpecialization(profile.specialization || '');
    setYearsOfExperience(profile.years_of_experience || '');
    
    // Parse languages_spoken if it's a string
    if (profile.languages_spoken) {
      if (typeof profile.languages_spoken === 'string') {
        try {
          setLanguagesSpoken(JSON.parse(profile.languages_spoken));
        } catch {
          setLanguagesSpoken([profile.languages_spoken]);
        }
      } else {
        setLanguagesSpoken(profile.languages_spoken);
      }
    }

    setLicenseNumber(profile.license_number || '');
    setRegistrationNumber(profile.registration_number || '');
    setHospitalName(profile.hospital_name || '');
    setAbhaId(profile.abha_id || '');
    setEmergencyContact(profile.emergency_contact || '');
    setLicenseStatus(profile.license_status || '');
    setLicenseValidTill(profile.license_valid_till || '');
    setProfilePhoto(profile.profile_picture_url || profile.profile_photo || '');
  }, [profile]);

  // Add language
  const addLanguage = () => {
    if (languageInput.trim() && !languagesSpoken.includes(languageInput.trim())) {
      setLanguagesSpoken([...languagesSpoken, languageInput.trim()]);
      setLanguageInput('');
    }
  };

  // Remove language
  const removeLanguage = (lang: string) => {
    setLanguagesSpoken(languagesSpoken.filter(l => l !== lang));
  };

  // Validate fields
  const validateForm = (): string | null => {
    if (!fullName.trim()) return 'Full name is required';
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
    if (!phoneNumber.trim()) return 'Phone number is required';
    if (!/^[0-9]{10}$/.test(phoneNumber.replace(/\D/g, ''))) return 'Phone number must be 10 digits';
    if (!licenseNumber.trim()) return 'License number is required';
    if (yearsOfExperience !== '' && (isNaN(Number(yearsOfExperience)) || Number(yearsOfExperience) < 0)) {
      return 'Years of experience must be a valid non-negative number';
    }
    return null;
  };

  // Update profile
  const updateProfile = async () => {
    const validationError = validateForm();
    if (validationError) {
      setUpdateMessage(`Error: ${validationError}`);
      setTimeout(() => setUpdateMessage(''), 5000);
      return;
    }

    setIsUpdating(true);
    setUpdateMessage('');

    try {
      const payload = {
        full_name: fullName,
        phone_number: phoneNumber,
        date_of_birth: dateOfBirth,
        gender,
        blood_group: bloodGroup,
        specialization,
        years_of_experience: yearsOfExperience ? Number(yearsOfExperience) : null,
        languages_spoken: languagesSpoken,
        license_number: licenseNumber,
        registration_number: registrationNumber,
        hospital_name: hospitalName,
        abha_id: abhaId,
        emergency_contact: emergencyContact,
        license_status: licenseStatus,
        license_valid_till: licenseValidTill,
        profile_photo: profilePhoto,
      };

      const res = await fetch(buildApiUrl('/api/doctors/profile/update'), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || `HTTP ${res.status}`);
      }

      const updated = await res.json();
      setUpdateMessage('Profile updated successfully!');
      
      // ===== Save updated profile to localStorage =====
      localStorage.setItem('doctor_profile', JSON.stringify(updated));
      localStorage.setItem('doctor_profile_updated_at', new Date().toISOString());
      
      // ===== Refresh profile from backend =====
      await refreshProfile();
      
      // ===== Dispatch event for other components to listen =====
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updated }));
      
      console.log('[DoctorProfilePage] Profile saved successfully:', updated);
      
      setTimeout(() => setUpdateMessage(''), 5000);
    } catch (e: any) {
      console.error('Update profile error:', e);
      setUpdateMessage(`Error: ${e.message || 'Failed to update profile'}`);
      setTimeout(() => setUpdateMessage(''), 5000);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-white text-lg">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">Error loading profile: {error}</p>
          <button
            onClick={onBack}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-white/10 py-6 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <ArrowLeft className="h-6 w-6 text-white" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Edit Profile</h1>
              <p className="text-white/60 text-sm mt-1">Update your professional and personal information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-white/10">
          <button
            onClick={() => setActiveTab('personal')}
            className={`px-6 py-3 font-medium transition-all border-b-2 ${
              activeTab === 'personal'
                ? 'text-emerald-500 border-emerald-500'
                : 'text-white/60 border-transparent hover:text-white/80'
            }`}
          >
            Personal Information
          </button>
          <button
            onClick={() => setActiveTab('professional')}
            className={`px-6 py-3 font-medium transition-all border-b-2 ${
              activeTab === 'professional'
                ? 'text-emerald-500 border-emerald-500'
                : 'text-white/60 border-transparent hover:text-white/80'
            }`}
          >
            Professional Information
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`px-6 py-3 font-medium transition-all border-b-2 ${
              activeTab === 'credentials'
                ? 'text-emerald-500 border-emerald-500'
                : 'text-white/60 border-transparent hover:text-white/80'
            }`}
          >
            Credentials & Licenses
          </button>
        </div>

        {/* Status Message */}
        {updateMessage && (
          <div className={`mb-6 p-4 rounded-lg ${
            updateMessage.includes('Error')
              ? 'bg-red-500/20 text-red-200 border border-red-500/50'
              : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50'
          }`}>
            {updateMessage}
          </div>
        )}

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Personal Information Tab */}
          {activeTab === 'personal' && (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6">Personal Information</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    disabled
                    className="w-full px-4 py-3 bg-white border border-white rounded-lg text-gray placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 opacity-60 cursor-not-allowed"
                  />
                  <p className="text-xs text-white mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter your phone number"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">ABHA ID</label>
                  <input
                    type="text"
                    value={abhaId}
                    onChange={(e) => setAbhaId(e.target.value)}
                    placeholder="Enter your ABHA-ID"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Emergency Contact</label>
                  <input
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Enter emergency contact number"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Professional Information Tab */}
          {activeTab === 'professional' && (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6">Professional Information</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Specialization</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g., Cardiology, General Medicine"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Years of Experience</label>
                  <input
                    type="number"
                    value={yearsOfExperience}
                    onChange={(e) => setYearsOfExperience(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Enter years of experience"
                    min="0"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Hospital Name</label>
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    placeholder="Enter hospital/clinic name"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Languages Spoken</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={languageInput}
                      onChange={(e) => setLanguageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addLanguage()}
                      placeholder="Add language and press Enter"
                      className="flex-1 px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={addLanguage}
                      className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition whitespace-nowrap"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {languagesSpoken.map((lang, idx) => (
                      <span
                        key={idx}
                        className="bg-emerald-500/20 text-emerald-200 px-3 py-1 rounded-full text-sm flex items-center gap-2 border border-emerald-500/50"
                      >
                        {lang}
                        <button
                          onClick={() => removeLanguage(lang)}
                          className="text-emerald-400 hover:text-emerald-300 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Credentials & Licenses Tab */}
          {activeTab === 'credentials' && (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6">Credentials & Licenses</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">License Number *</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="Enter license number"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400  focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Registration Number</label>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="Enter registration number"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">License Status</label>
                  <input
                    type="text"
                    value={licenseStatus}
                    onChange={(e) => setLicenseStatus(e.target.value)}
                    placeholder="e.g., Active & Verified"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">License Valid Till</label>
                  <input
                    type="text"
                    value={licenseValidTill}
                    onChange={(e) => setLicenseValidTill(e.target.value)}
                    placeholder="e.g., 2031"
                    className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={onBack}
              className="px-8 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition border border-white/20 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={updateProfile}
              disabled={isUpdating}
              className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUpdating && <Loader className="h-5 w-5 animate-spin" />}
              {isUpdating ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorProfilePage;
