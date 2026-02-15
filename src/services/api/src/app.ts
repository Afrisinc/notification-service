import Fastify, { FastifyInstance } from "fastify";
import {
  registerSecurityPlugin,
  registerRequestLifecyclePlugin,
  registerSwaggerPlugin,
  registerRoutesPlugin,
  registerErrorHandlerPlugin,
} from "./plugins";

export async function createFastifyApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
  });

  // Register plugins in order
  await registerSecurityPlugin(fastify);
  await registerRequestLifecyclePlugin(fastify);
  await registerSwaggerPlugin(fastify);
  await registerRoutesPlugin(fastify);
  await registerErrorHandlerPlugin(fastify);

  return fastify;
}
