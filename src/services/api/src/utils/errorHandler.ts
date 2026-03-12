/**
 * Error message extraction utility
 * Standardizes error handling across the application
 */

/**
 * Extract human-readable error message from any error type
 * @param error The error object (could be Error, string, or unknown)
 * @returns A human-readable error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }

  return 'An unexpected error occurred';
}
