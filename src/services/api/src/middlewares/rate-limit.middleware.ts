import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redisClient } from '@shared/redis';
import { logger } from '../config/logger';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (request: FastifyRequest) => string;
  message?: string;
}

export function createRateLimiter(name: string, config: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = config.keyGenerator
      ? config.keyGenerator(request)
      : (request.headers['x-account-id'] as string) || request.ip || 'anonymous';

    const redisKey = `ratelimit:${name}:${key}`;

    let count: number;
    let ttl: number;

    try {
      const results = await redisClient.multi().incr(redisKey).pttl(redisKey).exec();

      if (!results) throw new Error('Redis transaction returned no results');

      count = results[0][1] as number;
      ttl = results[1][1] as number;

      if (ttl < 0) {
        await redisClient.pexpire(redisKey, config.windowMs);
        ttl = config.windowMs;
      }
    } catch (err) {
      logger.error({ err, key: redisKey }, 'Rate limiter Redis error, failing open');
      return;
    }

    const remaining = Math.max(0, config.max - count);
    const resetTime = Math.ceil((Date.now() + ttl) / 1000);

    reply.header('X-RateLimit-Limit', config.max);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', resetTime);

    if (count > config.max) {
      const retryAfter = Math.ceil(ttl / 1000);
      reply.header('Retry-After', retryAfter);

      logger.warn({ key, count, limit: config.max }, 'Rate limit exceeded');

      return reply.code(429).send({
        success: false,
        resp_code: 4029,
        resp_msg: config.message || 'Too many requests, please try again later',
        data: {
          retryAfter,
          limit: config.max,
          windowMs: config.windowMs,
        },
      });
    }
  };
}

// Pre-configured rate limiters
export const rateLimiters = {
  // Standard API rate limit: 100 requests per minute per account
  api: createRateLimiter('api', {
    windowMs: 60 * 1000,
    max: 100,
    message: 'API rate limit exceeded. Maximum 100 requests per minute.',
  }),

  // Notification sending: 60 requests per minute per account
  notify: createRateLimiter('notify', {
    windowMs: 60 * 1000,
    max: 60,
    message: 'Notification rate limit exceeded. Maximum 60 sends per minute.',
  }),

  // Bulk operations: 10 requests per minute per account
  bulk: createRateLimiter('bulk', {
    windowMs: 60 * 1000,
    max: 10,
    message: 'Bulk operation rate limit exceeded. Maximum 10 bulk requests per minute.',
  }),

  // Auth endpoints: 20 requests per minute per IP
  auth: createRateLimiter('auth', {
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (request) => request.ip || 'anonymous',
    message: 'Authentication rate limit exceeded. Please wait before trying again.',
  }),

  // Admin endpoints: 30 requests per minute
  admin: createRateLimiter('admin', {
    windowMs: 60 * 1000,
    max: 30,
    message: 'Admin rate limit exceeded.',
  }),

  // Strict rate limit for sensitive operations: 5 per minute
  strict: createRateLimiter('strict', {
    windowMs: 60 * 1000,
    max: 5,
    message: 'Operation rate limit exceeded. Please wait before trying again.',
  }),
};

// Plugin to register rate limiting globally
export async function registerRateLimitPlugin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', rateLimiters.api);
  logger.info('Rate limiting plugin registered');
}
