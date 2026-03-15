/**
 * API Routes Index - Centralized route registration
 * All API v1 routes are registered through this module
 */

import { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health.routes';
import { registerNotifyRoutes } from './notify.routes';
import { registerTemplateRoutes } from './template.routes';
import { registerProjectRoutes } from './project.routes';
import { registerInternalRoutes } from './internal.routes';
import { authRoutes } from './auth.routes';
import { registerAppRoutes } from './app.routes';
import { registerOrganizationRoutes } from './organization.routes';
import { securityRoutes } from './security.routes';
import { platformRoutes } from './platform.routes';

//  Register all API v1 routes
export async function v1Routes(fastify: FastifyInstance) {
  await fastify.register(registerHealthRoutes, {
    prefix: '/health',
  });

  await fastify.register(authRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerAppRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerNotifyRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerTemplateRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerProjectRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerOrganizationRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerInternalRoutes, {
    prefix: '/internal',
  });
  await fastify.register(securityRoutes, {
    prefix: '/admin/internal',
  });
  await fastify.register(platformRoutes, {
    prefix: '/admin/internal',
  });
}
