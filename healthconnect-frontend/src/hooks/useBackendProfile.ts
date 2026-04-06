import { useEffect, useState } from 'react';
import { buildApiUrl } from '../config/api';

export type BackendProfile = {
  id?: number;
  user_id?: number;
  name?: string;
  full_name?: string;
  email?: string;
  role?: string;
  age?: number | null;
  gender?: string | null;
  bloodgroup?: string | null;
  blood_group?: string | null;
  allergy?: string | null;
  allergies?: string | null;
  medications?: string | null;
  surgeries?: string | null;
  dob?: string | null;
  phone?: string | null;
  emergency_contact?: string | null;
  picture?: string | null;
  profile_picture_url?: string | null;
  token?: string | null;
  
  // Doctor-specific fields
  specialization?: string | null;
  experience?: string | null;
  years_of_experience?: number | null;
  license_number?: string | null;
  registration_number?: string | null;
  registration_no?: string | null;
  hospital?: string | null;
  hospital_name?: string | null;
  qualifications?: string | null;
  years_practicing?: string | null;
  languages?: string | null;
  languages_spoken?: string | null;
  clinic_address?: string | null;
  consultation_fee?: string | null;
  about?: string | null;
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token') || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export const fetchBackendProfile = async (): Promise<BackendProfile> => {
  // Try doctor profile endpoint first, then fall back to users/me
  try {
    const token = localStorage.getItem('token') || '';
    if (!token) throw new Error('No token');

    // Try doctor-specific profile endpoint
    try {
      const doctorRes = await fetch(buildApiUrl('/api/doctors/profile'), {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (doctorRes.ok) {
        const data = await doctorRes.json();
        console.log('[useBackendProfile] Fetched doctor profile:', data);
        return data;
      }
    } catch (doctorErr) {
      console.log('[useBackendProfile] Doctor profile endpoint not available, falling back to users/me');
    }

    // Fall back to users/me endpoint
    const userRes = await fetch(buildApiUrl('/api/users/me'), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!userRes.ok) {
      throw new Error(`Profile fetch failed: ${userRes.status}`);
    }

    const data = await userRes.json();
    console.log('[useBackendProfile] Fetched user profile:', data);
    return data;
  } catch (error) {
    console.error('[useBackendProfile] Error fetching profile:', error);
    throw error;
  }
};

export const useBackendProfile = () => {
  const [profile, setProfile] = useState(null as BackendProfile | null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null as string | null);

  const refreshProfile = async () => {
    const token = localStorage.getItem('token') || '';
    if (!token) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchBackendProfile();
      setProfile(data);
      // ===== PERSIST to localStorage =====
      localStorage.setItem('doctor_profile', JSON.stringify(data));
      localStorage.setItem('doctor_profile_updated_at', new Date().toISOString());
      return data;
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch profile');
      setProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ===== Load from localStorage first (immediate, no flicker) =====
    const cachedProfile = localStorage.getItem('doctor_profile');
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        setProfile(parsed);
        setLoading(false);
      } catch (e) {
        console.error('Failed to parse cached profile:', e);
      }
    }

    // ===== Then fetch fresh data from backend =====
    refreshProfile();
  }, []);

  // ===== Listen for profile update events from other tabs/windows =====
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'doctor_profile' && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setProfile(updated);
          console.log('[useBackendProfile] Profile updated from storage event');
        } catch (err) {
          console.error('Failed to parse profile from storage event:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { profile, loading, error, refreshProfile, setProfile };
};
