import { FastifyInstance, FastifyError } from 'fastify';
import { logger } from '../config/logger';

interface ErrorWithStatusCode extends FastifyError {
  statusCode?: number;
  validation?: Array<{
    instancePath: string;
    schemaPath: string;
    keyword: string;
    params: Record<string, any>;
    message: string;
  }>;
}

/**
 * Format validation errors into human-readable messages
 */
function formatValidationErrors(errors: ErrorWithStatusCode['validation']): string {
  if (!errors || errors.length === 0) {
    return 'Request validation failed';
  }

  return errors
    .map((err) => {
      const field = err.instancePath.replace(/^\//, '') || 'root';
      const keyword = err.keyword;

      // Format specific validation keywords
      switch (keyword) {
        case 'format':
          return `${field}: Invalid format. Expected ${err.params.format} format`;
        case 'type':
          return `${field}: Invalid type. Expected ${err.params.type}`;
        case 'enum':
          return `${field}: Invalid value. Must be one of: ${err.params.allowedValues?.join(', ') || 'unknown'}`;
        case 'minLength':
          return `${field}: Too short. Minimum length is ${err.params.limit}`;
        case 'maxLength':
          return `${field}: Too long. Maximum length is ${err.params.limit}`;
        case 'minimum':
          return `${field}: Value too small. Minimum is ${err.params.limit}`;
        case 'maximum':
          return `${field}: Value too large. Maximum is ${err.params.limit}`;
        case 'required':
          return `${err.params.missingProperty}: This field is required`;
        default:
          return `${field}: ${err.message}`;
      }
    })
    .join('; ');
}

export async function registerErrorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: ErrorWithStatusCode, request, reply) => {
    const statusCode = error.statusCode || 500;

    // Handle JSON schema validation errors (e.g., invalid templateId format)
    if (error.validation && error.validation.length > 0) {
      const validationMessage = formatValidationErrors(error.validation);

      logger.warn(
        {
          validation: error.validation,
          requestId: request.id,
          method: request.method,
          url: request.url,
        },
        'Schema validation failed'
      );

      return reply.code(400).send({
        success: false,
        resp_code: 4000,
        resp_msg: validationMessage,
        errors: error.validation.map((err) => ({
          field: err.instancePath.replace(/^\//, '') || 'root',
          message: formatValidationErrors([err]),
        })),
      });
    }

    const message = error.message || 'Internal server error';

    logger.error(
      {
        error: message,
        stack: error.stack,
        statusCode,
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      'Unhandled error'
    );

    reply.code(statusCode).send({
      success: false,
      resp_code: statusCode * 10,
      resp_msg: message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  });
}
