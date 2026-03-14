import { config } from 'dotenv';
import { envMap } from './constants';
config();

const appEnv = process.env.APP_ENV?.toLowerCase() || 'development';
const envPrefix = envMap[appEnv] || 'DEV';
interface DbEnv {
  connectionString: string;
}

const createDbConfig = (envPrefix: string, typePrefix: string): DbEnv => {
  const dialet = process.env[`${envPrefix}_${typePrefix}_DB_DIALECT`];
  const host = process.env[`${envPrefix}_${typePrefix}_DB_HOST`];
  const port = process.env[`${envPrefix}_${typePrefix}_DB_PORT`];
  const user = process.env[`${envPrefix}_${typePrefix}_DB_USER`];
  const password = process.env[`${envPrefix}_${typePrefix}_DB_PASS`];
  const database = process.env[`${envPrefix}_${typePrefix}_DB_NAME`];

  // Validate all required fields
  if (!dialet || !host || !port || !user || !database) {
    throw new Error(
      `Missing required database configuration for ${envPrefix}_${typePrefix}.\n` +
        `Required variables: ${envPrefix}_${typePrefix}_DB_DIALECT, ${envPrefix}_${typePrefix}_DB_HOST, ` +
        `${envPrefix}_${typePrefix}_DB_PORT, ${envPrefix}_${typePrefix}_DB_USER, ${envPrefix}_${typePrefix}_DB_NAME\n` +
        `Please ensure all environment variables are properly set.`
    );
  }

  const connectionString = `${dialet}://${user}:${password}@${host}:${port}/${database}?schema=public`;
  process.env.DATABASE_URL = connectionString;
  return { connectionString };
};

export const dbConfig = {
  writeDBConnString: createDbConfig(envPrefix, 'WRITE').connectionString,
  readDBConnString: createDbConfig(envPrefix, 'READ').connectionString,
};
