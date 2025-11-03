import React from 'react';
import { useAuthContext } from '../contexts/AuthContext';

export const DebugOTP: React.FC = () => {
  const { user } = useAuthContext();
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 rounded-lg p-4 shadow-lg max-w-sm z-50">
      <div className="font-semibold text-yellow-800 mb-2">🔧 Development Mode</div>
      <div className="text-sm text-yellow-700">
        <p>OTPs are logged to browser console.</p>
        <p>Check F12 → Console for OTP codes.</p>
      </div>
    </div>
  );
};