import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';

export function getPostgresConnectionOptions(
  env: NodeJS.ProcessEnv = process.env,
): PostgresDataSourceOptions {
  const databaseUrl = env.DATABASE_URL?.trim();
  const hostValue = env.DB_HOST?.trim();
  const url =
    databaseUrl ||
    (hostValue?.startsWith('postgres://') ||
    hostValue?.startsWith('postgresql://')
      ? hostValue
      : undefined);

  if (url) {
    return {
      type: 'postgres',
      url,
      ssl: { rejectUnauthorized: false },
    };
  }

  return {
    type: 'postgres',
    host: hostValue,
    port: Number(env.DB_PORT) || 5432,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  };
}
