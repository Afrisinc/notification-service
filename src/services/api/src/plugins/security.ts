import { FastifyInstance } from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';

export async function registerSecurityPlugin(fastify: FastifyInstance) {
  // Security headers
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // CORS
  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-account-id'],
  });

  // Multipart form data (file uploads) - required for marketplace template assets
  await fastify.register(fastifyMultipart, {
    limits: {
      fieldNameSize: 100, // Max field name size
      fieldSize: 1000000, // 1 MB per field
      fields: 20, // Max number of fields
      fileSize: 104857600, // 100 MB max file size
      files: 10, // Max number of files
      headerPairs: 2000, // Max header pairs
    },
  });
}
