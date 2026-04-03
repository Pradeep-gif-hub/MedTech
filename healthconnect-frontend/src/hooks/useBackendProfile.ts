import { useEffect, useState } from 'react';
import { buildApiUrl } from '../config/api';

export type BackendProfile = {
  id?: number;
  user_id?: number;
  name?: string;
  email?: string;
  role?: string;
  age?: number | null;
  gender?: string | null;
  bloodgroup?: string | null;
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
  const res = await fetch(buildApiUrl('/api/users/me'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Profile fetch failed: ${res.status}`);
  }

  return res.json();
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
    refreshProfile();
  }, []);

  return { profile, loading, error, refreshProfile, setProfile };
};
