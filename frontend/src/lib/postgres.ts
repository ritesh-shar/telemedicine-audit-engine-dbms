import "server-only";
import { Pool, type PoolClient } from "pg";

// Reuse one PostgreSQL pool across requests and Next.js hot reloads.
const globalForPostgres = globalThis as typeof globalThis & {
  postgresPool?: Pool;
};

function getPool(): Pool {
  if (globalForPostgres.postgresPool) {
    return globalForPostgres.postgresPool;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "PostgreSQL configuration error: DATABASE_URL is missing. " +
        "Add DATABASE_URL to frontend/.env.local and restart the Next.js server."
    );
  }

  const newPool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  newPool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPostgres.postgresPool = newPool;
  }

  return newPool;
}

// Preserve the Pool API while deferring DATABASE_URL validation until a query runs.
export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const value = Reflect.get(getPool(), property);
    return typeof value === "function" ? value.bind(getPool()) : value;
  },
});

export function getPostgresPool(): Pool {
  return getPool();
}

/**
 * Execute multiple SQL statements in one transaction.
 * All statements use the same acquired database client.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch((rollbackError) => {
      console.error("PostgreSQL rollback failed:", rollbackError);
    });

    throw error;
  } finally {
    // Always release the client, including when a query fails.
    client.release();
  }
}
