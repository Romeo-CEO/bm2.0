import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { apiLogin, apiRegister, apiMe } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean; // in-flight login/register
  isBootstrapping: boolean; // initial token validation
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (userData: Partial<User>, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      console.log('🔍 AuthContext: Init | token?', !!token, '| storedUser?', !!storedUser);

      // Hydrate immediately if we have a stored user, to preserve session across refresh
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as User;
          setUser(parsed);
        } catch {}
      }

      if (!token) {
        setUser(null);
        setIsBootstrapping(false);
        return;
      }

      // Validate token in background with retries, but do NOT clear token immediately on failure
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await apiMe();
          console.log(`🔍 AuthContext: /me attempt ${attempt} result:`, res);
          if (res.success && res.data) {
            setUser(res.data as any);
            break;
          }
        } catch (e) {
          console.error(`AuthContext: /me attempt ${attempt} threw:`, e);
        }
        if (attempt < 3) await sleep(attempt === 1 ? 200 : 500);
      }

      setIsBootstrapping(false);
    })();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      // Clean slate before attempting login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);

      const res = await apiLogin(email, password);
      if (!res.success || !res.data) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        return { success: false, error: res.error || 'Login failed. Please try again.' };
      }
      const mapped: User = { ...(res.data as any) } as User;
      localStorage.setItem('user', JSON.stringify(mapped));
      setUser(mapped);
      // Post-auth intent redirect (handled in MainApp as well): ensure we land in app shell
      const rawIntent = localStorage.getItem('postAuthIntent');
      console.log('[AuthContext] Login success. hasIntent?', !!rawIntent);
      if (rawIntent) {
        try {
          const intent = JSON.parse(rawIntent) as { id: string; type: 'application' | 'template' };
          const hash = intent.type === 'template' ? 'templates' : 'business-tools';
          const base = (import.meta as any).env?.BASE_URL || '/';
          const to = base.endsWith('/') ? `${base}#${hash}` : `${base}/#${hash}`;
          console.log('[AuthContext] Redirecting to', to, 'for intent resolution');
          window.location.href = to;
        } catch {
          window.location.href = '/';
        }
      }
      return { success: true };
    } catch (e) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: Partial<User>, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await apiRegister({
        email: userData.email!,
        password,
        firstName: userData.firstName!,
        lastName: userData.lastName!,
        companyName: userData.companyName || `${userData.firstName} ${userData.lastName}`,
      });
      if (!res.success || !res.data) {
        return { success: false, error: res.error || 'Registration failed. Please try again.' };
      }
      const mapped: User = { ...(res.data as any) } as User;
      localStorage.setItem('user', JSON.stringify(mapped));
      setUser(mapped);
      // Post-auth intent redirect (handled in MainApp as well): ensure we land in app shell
      const rawIntent = localStorage.getItem('postAuthIntent');
      console.log('[AuthContext] Register success. hasIntent?', !!rawIntent);
      if (rawIntent) {
        try {
          const intent = JSON.parse(rawIntent) as { id: string; type: 'application' | 'template' };
          const hash = intent.type === 'template' ? 'templates' : 'business-tools';
          const base = (import.meta as any).env?.BASE_URL || '/';
          const to = base.endsWith('/') ? `${base}#${hash}` : `${base}/#${hash}`;
          console.log('[AuthContext] Redirecting to', to, 'for intent resolution');
          window.location.href = to;
        } catch {
          window.location.href = '/';
        }
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    } finally {
      setIsLoading(false);
    }
  };
  const refresh = async () => {
    try {
      const res = await apiMe();
      if (res.success && res.data) {
        const mapped: User = { ...(res.data as any) } as User;
        localStorage.setItem('user', JSON.stringify(mapped));
        setUser(mapped);
      }
    } catch {}
  };


  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  // Consider the presence of a token as authenticated; user profile will be fetched via /me
  const isAuthenticated = Boolean(localStorage.getItem('token'));

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, isBootstrapping, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};
