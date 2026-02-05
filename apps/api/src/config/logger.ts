import pino from 'pino';
import { getConfig } from './env';

const config = getConfig();

const pinoConfig =
  config.nodeEnv === 'production'
    ? {
        level: config.logLevel,
      }
    : {
        level: config.logLevel,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      };

export const logger = pino(pinoConfig);
