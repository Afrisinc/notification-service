import Fastify, { FastifyInstance } from 'fastify';
import {
  registerSecurityPlugin,
  registerRequestLifecyclePlugin,
  registerSwaggerPlugin,
  registerRoutesPlugin,
  registerErrorHandlerPlugin,
} from './plugins';
import { registerMetricsPlugin } from './plugins/metrics';
import { registerRateLimitPlugin } from './middlewares/rate-limit.middleware';
import { env } from './config/env';
import { initPaymentClient } from './utils/payment-client';
export async function createFastifyApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    trustProxy: true,
    connectionTimeout: 30000,
    keepAliveTimeout: 30000,
    pluginTimeout: 30000,
    bodyLimit: 10 * 1024 * 1024,
    caseSensitive: true,
    ignoreTrailingSlash: true,
  });

  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-ID', request.id);
  });

  fastify.addHook('onTimeout', async (request) => {
    request.log.warn({ requestId: request.id, url: request.url }, 'Request timeout');
  });

  await registerSecurityPlugin(fastify);
  await registerRateLimitPlugin(fastify);
  await registerMetricsPlugin(fastify);
  await registerRequestLifecyclePlugin(fastify);
  await registerSwaggerPlugin(fastify);
  await registerRoutesPlugin(fastify);
  await registerErrorHandlerPlugin(fastify);

  fastify.setErrorHandler((error, _request, reply) => {
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({
        success: false,
        resp_code: 4130,
        resp_msg: 'Request body too large',
      });
    }

    if (error.statusCode === 408 || error.code === 'FST_ERR_ASYNC_HOOK_TIMEOUT') {
      return reply.code(408).send({
        success: false,
        resp_code: 4080,
        resp_msg: 'Request timeout',
      });
    }

    throw error;
  });

  if (env.PAYMENT_API_KEY) {
    initPaymentClient({
      baseURL: env.PAYMENT_SERVICE_URL,
      apiKey: env.PAYMENT_API_KEY,
    });
  }

  return fastify;
}
