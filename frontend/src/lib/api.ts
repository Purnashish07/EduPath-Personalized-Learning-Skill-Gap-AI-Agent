import type { DocumentRecord } from '../types';

export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const USER_ID = 'demo-user';

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    // Non-JSON error body
  }
  return response.statusText || `Request failed (${response.status})`;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': USER_ID,
      ...(options.headers || {}),
    },
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
    headers: { 'x-user-id': USER_ID },
    body: form,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json() as Promise<DocumentRecord>;
}
