/**
 * API Configuration
 * Automatically detects environment and uses appropriate backend URL
 */

export const getAPIBaseUrl = (): string => {
  // Development environment - use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }

  // Production environment - use environment variable if available
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    console.log(`[API Config] Using VITE_API_URL: ${envUrl}`);
    return envUrl;
  }

  // Fallback to deployed backend
  console.warn('[API Config] VITE_API_URL not set, using default backend');
  return 'https://medtech-hcmo.onrender.com';
};

export const API_BASE_URL = getAPIBaseUrl();

/**
 * Build full API endpoint URL
 * @param endpoint - The endpoint path (e.g., '/api/users/login')
 * @returns Full URL
 */
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

console.log(`[API Config] Using backend: ${API_BASE_URL}`);
