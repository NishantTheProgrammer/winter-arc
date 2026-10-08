'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type ThemeContextType = {
  theme: string;
  setTheme: (t: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({ theme: 'default', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('default');

  useEffect(() => {
    const saved = localStorage.getItem('app-theme') || 'default';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return <ThemeContext.Provider value={{ theme, setTheme: changeTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
