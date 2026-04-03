/**
 * API Configuration
 * Automatically detects environment and uses appropriate backend URL
 */

export const getAPIBaseUrl = (): string => {
  // Development environment - use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }

  // Production environment - use deployed backend
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
