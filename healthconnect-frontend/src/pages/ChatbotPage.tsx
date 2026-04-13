import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, Loader, RotateCcw } from 'lucide-react';
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
    setError('Failed to load chatbot service. Make sure the chatbot server is running.');
  };

  const handleRetry = () => {
    console.log('[ChatbotPage] Retrying chatbot load...');
    setError(null);
    setIsLoading(true);
    // Force iframe reload by changing key
    setIframeKey(prev => prev + 1);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white p-4 shadow-lg flex items-center gap-4">
        <button
          onClick={() => {
            console.log('[ChatbotPage] Back button clicked');
            onClose();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors font-medium"
          aria-label="Close chatbot"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm">Back to Dashboard</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">🏥 MedTech AI Health Assistant</h1>
          <p className="text-sm text-purple-100">Medical advice powered by Groq AI</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="text-center space-y-6 px-6">
            <div className="flex justify-center">
              <Loader className="h-16 w-16 text-[#8b5cf6] animate-spin" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">Loading Health Assistant...</p>
              <p className="text-sm text-gray-600 mt-2">Connecting to medical AI service</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Connected to Groq AI</span>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
          <div className="bg-white border-2 border-red-200 rounded-2xl p-8 max-w-md text-center shadow-lg">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-3">Connection Failed</h2>
            <p className="text-gray-700 mb-6">{error}</p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2 text-sm text-gray-600">
              <p>💡 <strong>Troubleshooting:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>✓ Ensure chatbot server is running on port 3001 (dev)</li>
                <li>✓ Check internet connection</li>
                <li>✓ Verify GROQ_API_KEY is set in .env</li>
                <li>✓ Check browser console for detailed errors</li>
              </ul>
            </div>

            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-[#8b5cf6] text-white rounded-lg hover:bg-[#7c3aed] transition-colors font-semibold flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>
            
            <button
              onClick={() => {
                console.log('[ChatbotPage] Error page back button clicked');
                onClose();
              }}
              className="w-full mt-3 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
            >
              Return to Dashboard
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
