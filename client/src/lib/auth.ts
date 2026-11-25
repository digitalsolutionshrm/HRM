import { clearAccessToken, getAccessToken, setAccessToken } from './auth-storage';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://hrm-backend-m21k.onrender.com/api';
const USER_KEY = 'hrm_user';

export type UserRole = 'admin' | 'hr' | 'manager' | 'employee';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status?: boolean;
  profileImage?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  message?: string;
  user?: AuthUser;
}

type ApiBody = {
  data?: any;
  message?: string | string[];
  error?: string;
  [key: string]: any;
};

let refreshInFlight: Promise<string | null> | null = null;

function unwrapData(body: ApiBody): any {
  return body?.data ?? body;
}

function errorMessage(body: ApiBody, fallback: string): string {
  const message = body?.message ?? body?.data?.message ?? body?.error;

  if (Array.isArray(message)) {
    return message.join(', ');
  }

  return typeof message === 'string' && message.length > 0
    ? message
    : fallback;
}

async function readJson(response: Response): Promise<ApiBody> {
  try {
    return (await response.json()) as ApiBody;
  } catch {
    return {};
  }
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(API_URL + '/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  const result = await readJson(response);
  const data = unwrapData(result);

  if (!response.ok) {
    throw new Error(errorMessage(result, 'Invalid email or password.'));
  }

  if (!data?.accessToken || !data?.user) {
    throw new Error('Login succeeded, but the server returned an invalid response.');
  }

  setAccessToken(data.accessToken);

  let profileImage: string | null = null;

  try {
    const employeeResponse = await fetch(API_URL + '/employees/profile', {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: 'Bearer ' + data.accessToken,
      },
    });

    if (employeeResponse.ok) {
      const employeeResult = await readJson(employeeResponse);
      const employeeData = unwrapData(employeeResult);
      profileImage = employeeData?.profileImage ?? null;
    } else {
      console.warn('Employee profile request failed:', employeeResponse.status);
    }
  } catch (error) {
    console.error('Failed to fetch employee profile:', error);
  }

  return {
    accessToken: data.accessToken,
    user: {
      ...data.user,
      profileImage,
    },
  };
}

export function refreshAccessToken(): Promise<string | null> {
  if (!getAccessToken() && !localStorage.getItem(USER_KEY)) {
    return Promise.resolve(null);
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(API_URL + '/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          clearAccessToken();
          localStorage.removeItem(USER_KEY);
          return null;
        }

        const result = await readJson(response);
        const data = unwrapData(result);

        if (!data?.accessToken) {
          clearAccessToken();
          localStorage.removeItem(USER_KEY);
          return null;
        }

        setAccessToken(data.accessToken);
        return data.accessToken;
      } catch (error) {
        console.error('Refresh token request failed:', error);
        clearAccessToken();
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function logout(): Promise<void> {
  try {
    await fetch(API_URL + '/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout request failed:', error);
  } finally {
    clearAccessToken();
  }
}

export async function register(data: RegisterData): Promise<RegisterResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const accessToken = getAccessToken();

  if (accessToken) {
    (headers as Record<string, string>).Authorization =
      'Bearer ' + accessToken;
  }

  const response = await fetch(API_URL + '/users', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      ...data,
      email: data.email.trim().toLowerCase(),
    }),
  });

  const result = await readJson(response);
  const payload = unwrapData(result);

  if (!response.ok) {
    throw new Error(errorMessage(result, 'Account creation failed.'));
  }

  return payload as RegisterResponse;
}
