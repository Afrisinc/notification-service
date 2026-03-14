import { config } from 'dotenv';
config();

const NPort = process.env.NOTIFICATION_PORT || '3001';
export const PORT: number = parseInt(NPort, 10);
export const HOST: string = process.env.HOST ?? '0.0.0.0';

export const CONF_ENV: string = process.env.APP_ENV || 'local';
export const JWT_SECRET: string = process.env.AUTH_TOKEN || 'secret';
export const TOKEN_LIFE: string = process.env.TOKEN_LIFE || '1h';
export const privateKey: string = process.env.privateKey || 'secret';
export const RABBIT_PORT = process.env.RABBIT_PORT;
export const RABBIT_SERVER = process.env.RABBIT_SERVER;
export const RABBIT_USERNAME = process.env.RABBIT_USERNAME;
export const RABBIT_PASSWORD = process.env.RABBIT_PASSWORD;
export const RABBIT_PROTOCOL = process.env.RABBIT_PROTOCOL;
export const RABBIT_VHOST = process.env.RABBIT_VHOST;

export const envMap: Record<string, string> = {
  development: 'DEV',
  uat: 'UAT',
  production: 'PDN',
  test: 'TEST',
  qa: 'QA',
};
