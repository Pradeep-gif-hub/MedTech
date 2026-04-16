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
    const normalized = envUrl.replace(/\/$/, '');

    // Guard against misconfigured production env pointing API to static frontend host.
    if (normalized.includes('medtech-4rjc.onrender.com')) {
      const fallbackBackend = 'https://medtech-hcmo.onrender.com';
      console.warn(`[API Config] VITE_API_URL points to frontend host (${normalized}). Falling back to ${fallbackBackend}`);
      return fallbackBackend;
    }

    console.log(`[API Config] Using VITE_API_URL: ${normalized}`);
    return normalized;
  }

  // Fallback: never use hardcoded domain, fail loudly
  console.error('[API Config] ❌ VITE_API_URL is NOT set!');
  throw new Error('[CRITICAL] VITE_API_URL environment variable is required for production');
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
