export const API_BASE_URL = 'https://star-ai-kmfd.onrender.com';

type ApiOptions = RequestInit & { accessToken?: string };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || 'Unexpected response' }; }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? String(data.error) : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}
