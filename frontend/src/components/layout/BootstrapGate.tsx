import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const BootstrapGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isBootstrapping } = useAuth();
  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }
  return <>{children}</>;
};
