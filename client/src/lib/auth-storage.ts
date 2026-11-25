const ACCESS_TOKEN_KEY = 'hrm_access_token';

let accessToken: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (accessToken) {
    return accessToken;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken() {
  accessToken = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}
