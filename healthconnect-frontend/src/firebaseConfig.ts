// Google OAuth Configuration
// Client ID for Google Identity Services (pure OAuth without Firebase)
// Format: PROJECT_ID.apps.googleusercontent.com

export const GOOGLE_CLIENT_ID =
	import.meta.env.VITE_GOOGLE_CLIENT_ID ||
	"693090706948-2d1jp6de9otm6u70b6u7n196tn0mdepg.apps.googleusercontent.com";

// Backend API endpoint - deterministic local/prod switching
export const API_BASE_URL =
	window.location.hostname === 'localhost'
		? 'http://localhost:8000'
		: 'https://medtech-4rjc.onrender.com';


