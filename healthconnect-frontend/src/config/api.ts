/**
 * API Configuration
 * Automatically detects environment and uses appropriate backend URL
 */

export const getAPIBaseUrl = (): string => {
  // Development environment - use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }

  // Production environment - use environment variable if available.
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    const normalized = envUrl.replace(/\/$/, '');
    console.log(`[API Config] Using VITE_API_URL: ${normalized}`);
    return normalized;
  }

  // Safe production fallback.
  const browserOrigin = window.location.origin.replace(/\/$/, '');
  console.warn(`[API Config] VITE_API_URL not set. Falling back to browser origin: ${browserOrigin}`);
  return browserOrigin;
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
