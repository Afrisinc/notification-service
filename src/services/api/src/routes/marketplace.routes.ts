import type { FastifyInstance } from 'fastify';
import {
  listTemplates,
  getTemplateDetails,
  installTemplate,
  rateTemplate,
  getUserRating,
  getCategories,
  initTemplatePayment,
} from '../controllers/marketplace.controller';
import { validateBaseToken } from '../middlewares/auth.middleware';

export async function registerMarketplaceRoutes(app: FastifyInstance) {
  // List marketplace templates (public, but can be authenticated for personalization)
  app.get(
    '/marketplace/templates',
    {
      schema: {
        tags: ['Marketplace'],
        summary: 'List marketplace templates',
        description: 'Browse all available marketplace templates with filtering and search',
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Search by name or description' },
            channel: { type: 'string', description: 'Filter by channel (email, sms, push, in-app)' },
            category: {
              type: 'string',
              description: 'Filter by category (authentication, transactional, marketing, alerts)',
            },
            price: { type: 'string', description: 'Filter by price (free, paid)' },
            sortBy: { type: 'string', description: 'Sort by (rating, installs, price)' },
            sortOrder: { type: 'string', description: 'Sort direction (asc, desc)' },
            page: { type: 'number', description: 'Page number' },
            limit: { type: 'number', description: 'Items per page (max 50)' },
          },
        },
      },
    },
    listTemplates
  );

  // Get template details
  app.get(
    '/marketplace/templates/:templateId',
    {
      onRequest: [validateBaseToken],
      schema: {
        tags: ['Marketplace'],
        summary: 'Get template details',
        description: 'Get full details of a marketplace template including content and reviews',
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'Template ID' },
          },
          required: ['templateId'],
        },
      },
    },
    getTemplateDetails
  );

  // Install template to app
  app.post(
    '/marketplace/templates/:templateId/install',
    {
      onRequest: [validateBaseToken],
      schema: {
        tags: ['Marketplace'],
        summary: 'Install template to app',
        description: 'Install a marketplace template to your app',
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'Template ID' },
          },
          required: ['templateId'],
        },
        body: {
          type: 'object',
          properties: {
            appId: { type: 'string', description: 'App ID' },
            templateName: { type: 'string', description: 'Custom template name' },
            description: { type: 'string', description: 'Custom description' },
          },
          required: ['appId'],
        },
      },
    },
    installTemplate
  );

  // Rate template (before /my-rating to avoid route collision)
  app.post(
    '/marketplace/templates/:templateId/rate',
    {
      onRequest: [validateBaseToken],
      schema: {
        tags: ['Marketplace'],
        summary: 'Rate template',
        description: 'Submit a rating and review for a template',
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'Template ID' },
          },
          required: ['templateId'],
        },
        body: {
          type: 'object',
          properties: {
            rating: { type: 'number', minimum: 1, maximum: 5, description: 'Rating 1-5' },
            review: { type: 'string', description: 'Review text' },
            helpful: { type: 'boolean', description: 'Mark as helpful' },
          },
          required: ['rating'],
        },
      },
    },
    rateTemplate
  );

  // Get user rating (before :templateId param route)
  app.get(
    '/marketplace/templates/:templateId/my-rating',
    {
      onRequest: [validateBaseToken],
      schema: {
        tags: ['Marketplace'],
        summary: 'Get my rating',
        description: "Get the current user's rating for a template",
        params: {
          type: 'object',
          properties: {
            templateId: { type: 'string', description: 'Template ID' },
          },
          required: ['templateId'],
        },
      },
    },
    getUserRating
  );

  // Get marketplace categories
  app.get(
    '/marketplace/categories',
    {
      schema: {
        tags: ['Marketplace'],
        summary: 'Get categories',
        description: 'Get all marketplace template categories',
      },
    },
    getCategories
  );

  // Init payment for a paid template
  app.post(
    '/marketplace/templates/:templateId/payment/init',
    {
      onRequest: [validateBaseToken],
      schema: {
        tags: ['Marketplace'],
        summary: 'Init template purchase',
        description: 'Create a Stripe Payment Intent for a paid marketplace template',
        params: {
          type: 'object',
          properties: { templateId: { type: 'string' } },
          required: ['templateId'],
        },
        body: {
          type: 'object',
          properties: {
            appId: { type: 'string' },
            customerEmail: { type: 'string' },
          },
          required: ['appId', 'customerEmail'],
        },
      },
    },
    initTemplatePayment
  );
}
