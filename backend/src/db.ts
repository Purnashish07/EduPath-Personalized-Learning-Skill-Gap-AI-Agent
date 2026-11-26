import pg from 'pg';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL?.trim();

export const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: databaseUrl.includes('supabase')
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err.message);
  });
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[] | null> {
  if (!pool) return null;
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function checkDbHealth(): Promise<{
  configured: boolean;
  connected: boolean;
}> {
  if (!pool) {
    return { configured: false, connected: false };
  }
  try {
    await pool.query('SELECT 1');
    return { configured: true, connected: true };
  } catch (err) {
    console.warn(
      'PostgreSQL health check failed:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return { configured: true, connected: false };
  }
}
