import React, { createContext, useContext, useState, useEffect } from 'react';

interface GoogleUser {
  google_id: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

interface AuthContextType {
  user: GoogleUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  setUser: (user: GoogleUser | null) => void;
  setToken: (token: string | null) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  error: null,
  setUser: () => {},
  setToken: () => {},
  setError: () => {},
  logout: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');

    if (storedToken) {
      setToken(storedToken);
    }
    
    setLoading(false);
  }, []);

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('role');
  };

  const value = {
    user,
    token,
    loading,
    error,
    setUser,
    setToken,
    setError,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};


export default AuthProvider;