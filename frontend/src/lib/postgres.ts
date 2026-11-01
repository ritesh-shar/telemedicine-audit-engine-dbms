import { Pool } from "pg";

declare global {
  var postgresPool: Pool | undefined;
}

let pool: Pool | undefined;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "PostgreSQL configuration is missing. Set DATABASE_URL in the server environment."
    );
  }

  return databaseUrl;
}

export function getPostgresPool(): Pool {
  if (pool) {
    return pool;
  }

  if (global.postgresPool) {
    return global.postgresPool;
  }

  pool = new Pool({ connectionString: getDatabaseUrl() });

  if (process.env.NODE_ENV === "development") {
    global.postgresPool = pool;
  }

  return pool;
}
