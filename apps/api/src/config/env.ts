export interface Config {
  port: number;
  host: string;
  nodeEnv: string;
  logLevel: string;
  jwtSecret: string;
  redisUrl: string;
  databaseUrl: string;
  queueName: string;
}

export function getConfig(): Config {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/notify',
    queueName: process.env.QUEUE_NAME || 'notifications',
  };
}
