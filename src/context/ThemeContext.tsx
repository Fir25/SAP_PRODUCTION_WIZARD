import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// SAP Fiori-inspired color palette for industrial ERP/WMS
export const SAP_FIORI_COLORS = {
  // Primary colors (SAP Blue)
  primary: {
    50: '#e8f0fe',
    100: '#d2e3fc',
    200: '#aecbfa',
    300: '#8ab4f8',
    400: '#669df6',
    500: '#4285f4', // SAP Blue
    600: '#3367d6',
    700: '#2851a3',
    800: '#1a3c75',
    900: '#0d2548',
  },
  // Status colors
  success: {
    light: '#e6f4ea',
    DEFAULT: '#34a853',
    dark: '#1e8e3e',
  },
  warning: {
    light: '#fef7e0',
    DEFAULT: '#fbbc04',
    dark: '#f9ab00',
  },
  error: {
    light: '#fce8e6',
    DEFAULT: '#ea4335',
    dark: '#d93025',
  },
  // Neutral colors
  neutral: {
    50: '#f8f9fa',
    100: '#f1f3f4',
    200: '#e8eaed',
    300: '#dadce0',
    400: '#bdc1c6',
    500: '#5f6368',
    600: '#3c4043',
    700: '#202124',
    800: '#171717',
    900: '#0d0d0d',
  },
};

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  colors: typeof SAP_FIORI_COLORS;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    // Check for saved theme preference or system preference
    const savedMode = localStorage.getItem('theme-mode') as ThemeMode | null;
    if (savedMode) {
      setMode(savedMode);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setMode('dark');
    }
  }, []);

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    localStorage.setItem('theme-mode', newMode);
    
    // Apply theme to document
    if (newMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Apply theme on mount
  useEffect(() => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, colors: SAP_FIORI_COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
