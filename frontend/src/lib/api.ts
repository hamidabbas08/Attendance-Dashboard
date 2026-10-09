import { useAuthStore } from './store';

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

/** The current bearer token, sourced from the persisted auth store. */
export function getToken(): string | null {
  return useAuthStore.getState().token;
}

/** Thin fetch wrapper that attaches the bearer token and normalises errors. */
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      code: (body?.error?.code as string) ?? 'error',
      message: (body?.error?.message as string) ?? 'Request failed',
    };
    throw err;
  }
  return body as T;
}
