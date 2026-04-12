import { useEffect, useState } from 'react';
import { buildApiUrl } from '../config/api';

export type StoredUser = {
  user_id?: string | number;
  email?: string;
  name?: string;
  role?: string;
  age?: string | number | null;
  gender?: string | null;
  bloodgroup?: string | null;
  allergy?: string | null;
  dob?: string | null;
  phone?: string | null;
  picture?: string | null;
  avatar?: string | null;
  profile_picture_url?: string | null;
  photoURL?: string | null;
};

const normalizeUser = (input: any): StoredUser | null => {
  if (!input || typeof input !== 'object') return null;

  const picture =
    input.avatar ||
    input.picture ||
    input.profile_picture_url ||
    input.photoURL ||
    null;

  return {
    user_id: input.user_id,
    email: input.email,
    name: input.name || input.fullname || input.displayName,
    role: input.role,
    age: input.age ?? null,
    gender: input.gender ?? null,
    bloodgroup: input.bloodgroup || input.bloodGroup || null,
    allergy: input.allergy ?? null,
    dob: input.dob || input.birthdate || null,
    phone: input.phone || null,
    picture,
    avatar: picture,
    profile_picture_url: input.profile_picture_url || null,
    photoURL: input.photoURL || null,
  };
};

const readStoredUser = (): StoredUser | null => {
  return null;
};

export const useStoredUser = () => {
  const [user, setUser] = useState(readStoredUser() as StoredUser | null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const token = localStorage.getItem('token') || '';
      if (!token) {
        if (!cancelled) {
          setUser(null);
        }
        return;
      }

      try {
        const res = await fetch(buildApiUrl('/api/users/me'), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (!cancelled) {
            setUser(null);
          }
          return;
        }

        const profile = await res.json();
        if (!cancelled) {
          setUser(normalizeUser(profile));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      }
    };

    refresh();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'role' || e.key === null) {
        refresh();
      }
    };

    const onUserUpdated = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail && typeof detail === 'object' && (detail.email || detail.name || detail.id)) {
          const parsed = typeof detail === 'string' ? JSON.parse(detail) : detail;
          setUser(normalizeUser(parsed));
          return;
        }

        refresh();
      } catch {
        refresh();
      }
    };

    const onFocus = () => {
      refresh();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('user-updated', onUserUpdated as EventListener);
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('user-updated', onUserUpdated as EventListener);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return user;
};
