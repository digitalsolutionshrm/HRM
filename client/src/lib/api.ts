import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { refreshAccessToken } from './auth';
import { clearAccessToken, getAccessToken } from './auth-storage';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://hrm-backend-m21k.onrender.com/api';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | RetriableRequestConfig
      | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const newToken = await refreshAccessToken();

    if (newToken) {
      originalRequest.headers.Authorization = 'Bearer ' + newToken;
      return api(originalRequest);
    }

    clearAccessToken();
    return Promise.reject(error);
  },
);

export default api;

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  const sendRequest = (token: string | null) => {
    const headers = new Headers(options.headers);
    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (options.body && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', 'Bearer ' + token);
    }

    return fetch(API_URL + endpoint, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  let response = await sendRequest(getAccessToken());

  if (
    response.status === 401 &&
    retry &&
    !endpoint.includes('/auth/refresh')
  ) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      response = await sendRequest(newToken);
    } else {
      clearAccessToken();
    }
  }

  return response;
}
