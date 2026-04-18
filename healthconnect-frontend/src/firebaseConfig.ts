// Google OAuth Configuration
// Client ID for Google Identity Services (pure OAuth without Firebase)
// Format: PROJECT_ID.apps.googleusercontent.com

export const GOOGLE_CLIENT_ID =
	import.meta.env.VITE_GOOGLE_CLIENT_ID ||
	"693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg.apps.googleusercontent.com";

// Backend API endpoint - use environment variable or localhost for dev
// Check if running on localhost, if so always use localhost:8000
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (isLocalhost ? 'http://localhost:8000' : 'https://medtech-4rjc.onrender.com');

console.log('[firebaseConfig] Running on:', window.location.hostname);
console.log('[firebaseConfig] API_BASE_URL:', API_BASE_URL);


