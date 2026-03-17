import { logger } from '../config/logger';

/**
 * Custom database error class for consistent error handling
 */
export class DatabaseError extends Error {
  constructor(
    public code: string,
    public originalError: unknown,
    message: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Transform Prisma errors to application errors
 */
export function transformPrismaError(error: unknown, context: string): Error {
  const err = error as any;

  // Unique constraint violation
  if (err.code === 'P2002') {
    const fields = err.meta?.target || ['field'];
    let message = `${fields.join(', ')} already exists`;

    // Provide specific message for template unique constraint
    if (context === 'template.repository' && fields.includes('code')) {
      message = `A template with code "${err.meta?.code || 'unknown'}", channel, and language already exists for this account`;
    }

    logger.warn({ context, fields }, message);
    return new DatabaseError('UNIQUE_CONSTRAINT_VIOLATION', error, message);
  }

  // Record not found
  if (err.code === 'P2025') {
    const message = 'Record not found';
    logger.warn({ context }, message);
    return new DatabaseError('NOT_FOUND', error, message);
  }

  // Foreign key constraint
  if (err.code === 'P2003') {
    const relation = err.meta?.relation_name || 'unknown relation';
    const message = `Invalid reference to ${relation}`;
    logger.warn({ context, relation }, message);
    return new DatabaseError('INVALID_REFERENCE', error, message);
  }

  // Required field missing
  if (err.code === 'P2011') {
    const field = err.meta?.constraint || 'field';
    const message = `Required field missing: ${field}`;
    logger.warn({ context, field }, message);
    return new DatabaseError('REQUIRED_FIELD_MISSING', error, message);
  }

  // Type validation error
  if (err.code === 'P2013') {
    const message = 'Invalid field type';
    logger.warn({ context }, message);
    return new DatabaseError('INVALID_TYPE', error, message);
  }

  // Database connection error
  if (err.code === 'P1002' || err.code === 'P1001') {
    const message = 'Database connection failed';
    logger.error({ context, code: err.code }, message);
    return new DatabaseError('CONNECTION_FAILED', error, message);
  }

  // Timeout error
  if (err.code === 'P1008') {
    const message = 'Database operation timeout';
    logger.error({ context }, message);
    return new DatabaseError('TIMEOUT', error, message);
  }

  // Default: log and return generic error
  logger.error(
    {
      context,
      error: err.message,
      code: err.code,
    },
    'Unknown database error'
  );

  return new DatabaseError('UNKNOWN', error, `Database error: ${err.message || 'Unknown'}`);
}

/**
 * Wrapper for database operations with error transformation
 */
export async function executeDbOperation<T>(operation: () => Promise<T>, context: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw transformPrismaError(error, context);
  }
}
