import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ChatbotPageProps {
  onClose: () => void;
}

const ChatbotPage: React.FC<ChatbotPageProps> = ({ onClose }) => {
  const { token, user } = useAuth();
  const [chatbotUrl, setChatbotUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // Determine chatbot URL based on environment
  useEffect(() => {
    console.log('[ChatbotPage] Component mounted, initializing...');
    console.log('[ChatbotPage] Environment mode:', import.meta.env.MODE);
    console.log('[ChatbotPage] User:', user?.email || 'Anonymous');
    console.log('[ChatbotPage] Token present:', !!token);

    const isDev = import.meta.env.MODE === 'development';
    const devUrl = 'http://localhost:3001';
    const prodUrl = 'https://medtech-chatbot.onrender.com'; // Update this with actual production chatbot URL
    
    const baseUrl = isDev ? devUrl : prodUrl;
    console.log('[ChatbotPage] Using base URL:', baseUrl, '( Mode: ' + (isDev ? 'DEV' : 'PROD') + ' )');
    
    // The chatbot service serves its HTML directly, we just iframe it
    // No need to pass params in URL - chatbot is independent
    const fullUrl = `${baseUrl}/`;
    console.log('[ChatbotPage] Full iframe URL:', fullUrl);
    
    setChatbotUrl(fullUrl);
  }, [token, user]);

  const handleIframeLoad = () => {
    console.log('[ChatbotPage] ✅ Chatbot iframe loaded successfully');
    setIsLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    console.error('[ChatbotPage] ❌ Failed to load chatbot iframe');
    setIsLoading(false);
    
    // Check if we're in production trying to access non-existent service
    const isDev = import.meta.env.MODE === 'development';
    if (!isDev) {
      setError(
        '🚀 Chatbot service not yet deployed to production.\n\n' +
        'To use the AI health chatbot, the backend service needs to be deployed to Render.\n\n' +
        '📋 DEPLOYMENT STEPS:\n' +
        '1. Push healthconnect-chatbot/ to your GitHub repo\n' +
        '2. Create new Render Web Service from the repo\n' +
        '3. Set Environment Variables:\n' +
        '   - GROQ_API_KEY (from console.groq.com)\n' +
        '   - PORT: 3001\n' +
        '4. Deploy and get the service URL\n' +
        '5. Update ChatbotPage.tsx production URL:\n' +
        '   const prodUrl = "https://your-chatbot.onrender.com"\n\n' +
        '✨ In development, it uses localhost:3001'
      );
    } else {
      setError(
        'Failed to load chatbot service.\n\n' +
        'Please check:\n' +
        '• Chatbot service is deployed to production\n' +
        '• GROQ_API_KEY is set in Render environment\n' +
        '• Production URL is correct in code\n' +
        '• Service is running (check Render dashboard)'
      );
    }
  };

  const handleRetry = () => {
    console.log('[ChatbotPage] Retrying chatbot load...');
    setError(null);
    setIsLoading(true);
    // Force iframe reload by changing key
    setIframeKey(prev => prev + 1);
  };

  return (
    <div className="fixed inset-0 bg-[#efeae2] z-50 flex flex-col">{/* Chatbot handles its own header and UI */}

      {/* Loading State - Minimal overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#efeae2] z-40 flex items-center justify-center">
          <div className="text-center">
            <Loader className="h-12 w-12 text-[#128c7e] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600">Loading Health Assistant...</p>
          </div>
        </div>
      )}

      {/* Error State - Minimal alert */}
      {error && (
        <div className="absolute inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm text-center">
            <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-3" />
            <h2 className="font-bold text-gray-900 mb-2">Connection Error</h2>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-[#128c7e] text-white rounded-lg hover:bg-[#0d6d5f] transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Chatbot Iframe */}
      {chatbotUrl && !error && (
        <iframe
          key={iframeKey}
          src={chatbotUrl}
          title="MedTech AI Health Assistant"
          className="flex-1 w-full border-none bg-[#0a0c10]"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          style={{
            display: isLoading ? 'none' : 'block',
          }}
        />
      )}

      {/* Debug info (remove in production) */}
      {import.meta.env.DEV && (
        <div className="absolute top-20 right-4 bg-black/50 text-white text-xs p-2 rounded opacity-50 hover:opacity-100 max-w-xs">
          <p>URL: {chatbotUrl}</p>
          <p>Mode: {import.meta.env.MODE}</p>
          <p>Loading: {isLoading.toString()}</p>
        </div>
      )}
    </div>
  );
};

export default ChatbotPage;
