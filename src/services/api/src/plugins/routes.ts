import { FastifyInstance } from 'fastify';
import { v1Routes } from '../routes';

export async function registerRoutesPlugin(fastify: FastifyInstance) {
  // Register all routes with their configured prefixes
  await fastify.register(v1Routes);
}
