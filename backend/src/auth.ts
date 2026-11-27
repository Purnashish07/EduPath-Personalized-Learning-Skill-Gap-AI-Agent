export class AuthenticationError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export async function verifySupabaseAccessToken(
  token: string,
  fetcher: typeof fetch = fetch
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new AuthenticationError(
      503,
      'Supabase authentication is not configured'
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(401, 'Invalid or expired access token');
    }
    if (!response.ok) {
      throw new AuthenticationError(
        502,
        'Supabase authentication service returned an error'
      );
    }
    const user: unknown = await response.json();
    if (
      typeof user !== 'object' ||
      user === null ||
      !('id' in user) ||
      typeof user.id !== 'string' ||
      user.id.length === 0
    ) {
      throw new AuthenticationError(
        502,
        'Supabase authentication service returned an invalid user'
      );
    }
    return user.id;
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError(
      503,
      'Unable to verify access token with Supabase Auth'
    );
  } finally {
    clearTimeout(timeout);
  }
}
