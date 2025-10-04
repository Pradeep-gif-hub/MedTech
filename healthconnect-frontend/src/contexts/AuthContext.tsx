import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  error: null,
  setUser: () => {},
  setToken: () => {},
  setError: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setToken(token);
          setError(null);
        } catch (err) {
          setError('Failed to get auth token');
          console.error('Auth token error:', err);
        }
      } else {
        setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    token,
    loading,
    error,
    setUser,
    setToken,
    setError,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;