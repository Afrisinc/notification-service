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
import { registerAppSettingsRoutes } from './app-settings.routes';
import { registerMarketplaceRoutes } from './marketplace.routes';
import { registerOrganizationRoutes } from './organization.routes';
import { securityRoutes } from './security.routes';
import { platformRoutes } from './platform.routes';
import { apiKeyRoutes } from './api-key.routes';
import { registerContactRoutes } from './contact.routes';
import { registerCampaignRoutes } from './campaign.routes';
import { registerNotificationLogsRoutes } from './notification-logs.routes';
import { registerSubscriptionRoutes } from './subscription.routes';
import { registerPlanManagementRoutes } from './plan-management.routes';
import { registerAppEmailConfigRoutes } from './app-email-config.routes';

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

  await fastify.register(registerAppSettingsRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerMarketplaceRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerContactRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerCampaignRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerNotificationLogsRoutes, {
    prefix: '/api',
  });

  await fastify.register(apiKeyRoutes, {
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

  await fastify.register(registerSubscriptionRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerPlanManagementRoutes, {
    prefix: '/api',
  });

  await fastify.register(registerAppEmailConfigRoutes, {
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
