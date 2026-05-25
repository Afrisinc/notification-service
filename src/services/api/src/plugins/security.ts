import { FastifyInstance } from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import { getConfig } from '@shared/config';
import { logger } from '../config/logger';

function parseAllowedOrigins(): (string | RegExp)[] {
  const config = getConfig();
  const corsOrigins = config.CORS_ORIGINS || '';

  if (!corsOrigins || corsOrigins === '*') {
    if (config.NODE_ENV === 'production') {
      logger.warn('CORS_ORIGINS not configured in production - defaulting to strict mode');
      return [];
    }
    return [/localhost:\d+$/, /127\.0\.0\.1:\d+$/];
  }

  return corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      if (origin.includes('*')) {
        const pattern = origin.replace(/\./g, '\\.').replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`);
      }
      return origin;
    });
}

export async function registerSecurityPlugin(fastify: FastifyInstance) {
  const config = getConfig();
  const allowedOrigins = parseAllowedOrigins();

  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", ...allowedOrigins.filter((o): o is string => typeof o === 'string')],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (config.NODE_ENV === 'development') {
        callback(null, true);
        return;
      }

      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') {
          return allowed === origin;
        }
        return allowed.test(origin);
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn({ origin }, 'CORS request blocked from unauthorized origin');
        callback(new Error('CORS not allowed'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-account-id', 'x-api-key', 'x-request-id', 'x-correlation-id'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    maxAge: 86400,
  });

  await fastify.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1000000,
      fields: 20,
      fileSize: 104857600,
      files: 10,
      headerPairs: 2000,
    },
  });

  logger.info(
    { origins: allowedOrigins.length, env: config.NODE_ENV },
    'Security plugin registered with CORS whitelist'
  );
}
