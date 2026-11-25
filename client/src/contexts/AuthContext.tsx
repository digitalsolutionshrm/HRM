'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { refreshAccessToken } from '@/lib/auth';
import {
  clearAccessToken,
  setAccessToken,
} from '@/lib/auth-storage';

export type UserRole = 'admin' | 'hr' | 'manager' | 'employee';

export interface AuthUser {
  id: number;
  name?: string;
  email: string;
  role: UserRole;
  status?: boolean;
  profileImage?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: (accessToken: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://hrm-backend-m21k.onrender.com/api';

const ACCESS_TOKEN_KEY = 'hrm_access_token';
const USER_KEY = 'hrm_user';

function userFromResponse(body: any): AuthUser | null {
  const payload = body?.data ?? body;
  const user = payload?.user ?? payload;

  return user && typeof user.id === 'number'
    ? (user as AuthUser)
    : null;
}

async function fetchCurrentUser(token: string): Promise<Response> {
  return fetch(API_URL + '/auth/me', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
}

// The auth endpoints do not return the profile image, so merge it in from the
// employee profile when the signed-in user has one (admin/HR may not).
async function withEmployeeProfile(
  user: AuthUser,
  token: string,
): Promise<AuthUser> {
  try {
    const response = await fetch(API_URL + '/employees/profile', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) return user;

    const body = await response.json();
    const profile = body?.data ?? body;

    if (!profile || typeof profile !== 'object') return user;

    const fullName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
      || profile.user?.name
      || user.name;

    return {
      ...user,
      name: fullName,
      profileImage: profile.profileImage ?? user.profileImage ?? null,
    };
  } catch {
    return user;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setCurrentAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        let token = localStorage.getItem(ACCESS_TOKEN_KEY);

        if (!token) {
          token = await refreshAccessToken();
        }

        if (!token) {
          clearAccessToken();
          localStorage.removeItem(USER_KEY);
          setUser(null);
          setCurrentAccessToken(null);
          return;
        }

        setAccessToken(token);
        setCurrentAccessToken(token);

        let response = await fetchCurrentUser(token);

        if (response.status === 401) {
          const refreshedToken = await refreshAccessToken();

          if (refreshedToken) {
            token = refreshedToken;
            setAccessToken(token);
            setCurrentAccessToken(token);
            response = await fetchCurrentUser(token);
          }
        }

        if (!response.ok) {
          clearAccessToken();
          localStorage.removeItem(USER_KEY);
          setCurrentAccessToken(null);
          setUser(null);
          return;
        }

        const result = await response.json();
        const authenticatedUser = userFromResponse(result);

        if (!authenticatedUser) {
          console.warn('The server returned an unrecognized current-user response.');
          return;
        }

        const enrichedUser = await withEmployeeProfile(authenticatedUser, token);
        setUser(enrichedUser);
        localStorage.setItem(USER_KEY, JSON.stringify(enrichedUser));
      } catch (error) {
        console.error('Authentication initialization failed:', error);
        clearAccessToken();
        localStorage.removeItem(USER_KEY);
        setCurrentAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(
    (newAccessToken: string, authenticatedUser: AuthUser) => {
      setAccessToken(newAccessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(authenticatedUser));
      setCurrentAccessToken(newAccessToken);
      setUser(authenticatedUser);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await fetch(API_URL + '/auth/logout', {
        method: 'POST',
        headers: accessToken
          ? { Authorization: 'Bearer ' + accessToken }
          : undefined,
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      clearAccessToken();
      localStorage.removeItem(USER_KEY);
      setCurrentAccessToken(null);
      setUser(null);
    }
  }, [accessToken]);

  const refreshUser = useCallback(async () => {
    let token = accessToken;

    if (!token) {
      token = await refreshAccessToken();
    }

    if (!token) {
      // A transient refresh failure must not turn into a local logout.
      return;
    }

    setAccessToken(token);
    setCurrentAccessToken(token);

    try {
      let response = await fetchCurrentUser(token);

      if (response.status === 401) {
        const refreshedToken = await refreshAccessToken();

        if (refreshedToken) {
          token = refreshedToken;
          setAccessToken(token);
          setCurrentAccessToken(token);
          response = await fetchCurrentUser(token);
        }
      }

      if (!response.ok) {
        await logout();
        return;
      }

      const result = await response.json();
      const authenticatedUser = userFromResponse(result);

      if (!authenticatedUser) {
        await logout();
        return;
      }

      const enrichedUser = await withEmployeeProfile(authenticatedUser, token);
      setUser(enrichedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(enrichedUser));
    } catch (error) {
      console.error('Unable to refresh user:', error);
    }
  }, [accessToken, logout]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    accessToken,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }

  return context;
}
