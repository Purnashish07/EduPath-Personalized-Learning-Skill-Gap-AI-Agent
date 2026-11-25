import pg from 'pg';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL?.trim();

export const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('supabase')
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
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
