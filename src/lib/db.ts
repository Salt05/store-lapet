// src/lib/db.ts
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

export function getConnectionString(): string {
  if (process.env.DATABASE_URL) {
    if (process.env.POSTGRES_PORT) {
      return process.env.DATABASE_URL.replace(/:\d+\//, `:${process.env.POSTGRES_PORT}/`);
    }
    // Auto-route from legacy 5433 to designated independent lapet-postgres port 5434
    if (process.env.DATABASE_URL.includes(':5433/')) {
      return process.env.DATABASE_URL.replace(':5433/', ':5434/');
    }
    return process.env.DATABASE_URL;
  }
  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '5434';
  const user = process.env.POSTGRES_USER || 'crmuser';
  const password = process.env.POSTGRES_PASSWORD || 'zalocrm_secure_password';
  const db = process.env.POSTGRES_DB || 'zalocrm';
  return `postgresql://${user}:${password}@${host}:${port}/${db}`;
}

export function getPgPool(): Pool {
  if (!pool) {
    const connStr = getConnectionString();
    pool = new Pool({
      connectionString: connStr,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]:', err);
    });
  }
  return pool;
}

export async function getClient(): Promise<PoolClient> {
  return await getPgPool().connect();
}

export async function generateNextOrderCode(clientOrPool?: Pool | PoolClient): Promise<string> {
  const executor = clientOrPool || getPgPool();
  // Đảm bảo sequence đã tồn tại
  await executor.query(`CREATE SEQUENCE IF NOT EXISTS order_code_seq START WITH 2457`);
  const res = await executor.query(`SELECT nextval('order_code_seq') as next_val`);
  const num = parseInt(res.rows[0].next_val, 10);
  return 'S' + String(num).padStart(5, '0');
}

export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  const p = getPgPool();
  return await p.query<R>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[PostgreSQL withTransaction Rollback Error]:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
