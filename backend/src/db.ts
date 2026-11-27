import pg from 'pg';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL?.trim();

function databaseErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return 'unknown';
}

export const pool = databaseUrl
  ? new pg.Pool({
      connectionString: databaseUrl,
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      ssl: databaseUrl.includes('supabase')
        ? { rejectUnauthorized: true }
        : undefined,
    })
  : null;

pool?.on('error', (error) => {
  console.error('[EduPath PostgreSQL pool error]', databaseErrorCode(error));
});

export async function checkDbHealth(): Promise<{
  configured: boolean;
  connected: boolean;
}> {
  if (!pool) {
    return { configured: false, connected: false };
  }
  try {
    await pool.query('select 1');
    return { configured: true, connected: true };
  } catch (error) {
    console.error(
      '[EduPath PostgreSQL health check failed]',
      databaseErrorCode(error)
    );
    return { configured: true, connected: false };
  }
}
