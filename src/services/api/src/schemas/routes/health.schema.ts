/**
 * Health Check Route Schemas
 * Validation schemas for liveness and readiness probes
 */

const checkResultSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['up', 'down'] },
    latencyMs: { type: 'number' },
    error: { type: 'string' },
  },
  required: ['status'],
};

export const livenessSchema = {
  description: 'Liveness probe - checks if the service is running',
  tags: ['Health'],
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['up'] },
      },
      required: ['status'],
    },
  },
};

export const readinessSchema = {
  description: 'Readiness probe - checks if dependencies are healthy',
  tags: ['Health'],
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded'] },
        statusCode: { type: 'number' },
        db: {
          type: 'object',
          properties: {
            read: checkResultSchema,
            write: checkResultSchema,
          },
        },
        rabbit: {
          type: 'object',
          properties: {
            consumer: checkResultSchema,
            publisher: checkResultSchema,
          },
        },
      },
      required: ['status'],
    },
    503: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded'] },
        statusCode: { type: 'number' },
        db: {
          type: 'object',
          properties: {
            read: checkResultSchema,
            write: checkResultSchema,
          },
        },
        rabbit: {
          type: 'object',
          properties: {
            consumer: checkResultSchema,
            publisher: checkResultSchema,
          },
        },
      },
      required: ['status'],
    },
  },
};
