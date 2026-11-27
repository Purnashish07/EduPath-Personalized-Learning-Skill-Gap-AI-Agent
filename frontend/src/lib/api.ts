import type { DocumentRecord } from '../types';
import { getAccessToken } from './auth';

export const API_BASE =
  import.meta.env.VITE_API_URL || '/api';

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    // Non-JSON error body
  }
  return response.statusText || `Request failed (${response.status})`;
}

async function requestHeaders(
  headers?: HeadersInit
): Promise<Headers> {
  const requestHeaders = new Headers(headers);
  const token = await getAccessToken();
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
  return requestHeaders;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await requestHeaders(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<T>;
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: await requestHeaders(),
    body: form,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<DocumentRecord>;
}
