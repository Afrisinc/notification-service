/**
 * Central export point for all API schemas
 *
 * Schema organization:
 * - common/: Shared schemas (errors, pagination, headers)
 * - notify/: Notification endpoint schemas
 * - template/: Template endpoint schemas
 *
 * Usage:
 * import { sendNotificationSchema } from '@/schemas';
 * import { createTemplateSchema } from '@/schemas';
 */

// Common schemas (errors, pagination, etc.)
export * from './common';

// Notification schemas
export * from './notify';

// Template schemas
export * from './template';
