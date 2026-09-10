import * as SecureStore from 'expo-secure-store';
import { apiFetch, ApiError } from './api';

const ACCESS_KEY = 'star_ai_access_token';
const REFRESH_KEY = 'star_ai_refresh_token';

export type User = {
  id: number;
  name: string;
  email: string;
  plan?: string;
  credits?: number;
  role?: string;
};

type AuthResponse = {
  ok: boolean;
  user: User;
  access_token: string;
  refresh_token: string;
};

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export const clearSession = clearTokens;

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function login(email: string, password: string) {
  const result = await apiFetch<AuthResponse>('/api/auth/mobile/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  await saveTokens(result.access_token, result.refresh_token);
  return result.user;
}

export async function register(name: string, email: string, password: string) {
  const result = await apiFetch<AuthResponse>('/api/auth/mobile/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password })
  });
  await saveTokens(result.access_token, result.refresh_token);
  return result.user;
}

export async function refreshSession() {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const result = await apiFetch<AuthResponse>('/api/auth/mobile/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    await saveTokens(result.access_token, result.refresh_token);
    return result.user;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function getMe() {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  try {
    const result = await apiFetch<{ ok: boolean; user: User }>('/api/auth/mobile/me', { accessToken });
    return result.user;
  } catch (error) {
    if (error instanceof ApiError && error.status !== 401) throw error;
    return refreshSession();
  }
}

export async function authenticatedFetch<T>(path: string, options: RequestInit = {}) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new ApiError('Authentication required', 401, null);
  try {
    return await apiFetch<T>(path, { ...options, accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const refreshedUser = await refreshSession();
    if (!refreshedUser) throw error;
    const retryToken = await getAccessToken();
    if (!retryToken) throw error;
    return apiFetch<T>(path, { ...options, accessToken: retryToken });
  }
}
