import React, { createContext, useContext } from 'react';
import { useForensics, ForensicsContextType } from '../hooks/useForensics';

const ForensicsContext = createContext<ForensicsContextType | null>(null);

export const ForensicsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const forensics = useForensics();
  return (
    <ForensicsContext.Provider value={forensics}>
      {children}
    </ForensicsContext.Provider>
  );
};

export const useForensicsContext = () => {
  const ctx = useContext(ForensicsContext);
  if (!ctx) {
    throw new Error('useForensicsContext must be used within a ForensicsProvider');
  }
  return ctx;
};
