import { FastifyInstance } from 'fastify';
import { templateController } from '../controllers/template.controller';
import {
  createTemplateSchema,
  getTemplateSchema,
  listTemplatesSchema,
  updateTemplateSchema,
  deleteTemplateSchema,
} from '../schemas/template';
import { gatewayHeaders } from '../schemas/common';

export async function registerTemplateRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/templates',
    {
      // Auth handled by API Gateway
      schema: {
        ...createTemplateSchema,
        headers: gatewayHeaders,
      },
    },
    (request, reply) => templateController.createTemplate(request, reply)
  );

  fastify.get(
    '/templates',
    {
      // Auth handled by API Gateway
      schema: {
        ...listTemplatesSchema,
        headers: gatewayHeaders,
      },
    },
    (request, reply) => templateController.listTemplates(request, reply)
  );

  fastify.get(
    '/templates/:id',
    {
      // Auth handled by API Gateway
      schema: {
        ...getTemplateSchema,
        headers: gatewayHeaders,
      },
    },
    (request, reply) => templateController.getTemplate(request, reply)
  );

  fastify.put(
    '/templates/:id',
    {
      // Auth handled by API Gateway
      schema: {
        ...updateTemplateSchema,
        headers: gatewayHeaders,
      },
    },
    (request, reply) => templateController.updateTemplate(request, reply)
  );

  fastify.delete(
    '/templates/:id',
    {
      // Auth handled by API Gateway
      schema: {
        ...deleteTemplateSchema,
        headers: gatewayHeaders,
      },
    },
    (request, reply) => templateController.deleteTemplate(request, reply)
  );
}