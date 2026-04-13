/**
 * SMS Worker - Entry point
 * This file is kept for backward compatibility but delegates to index.ts
 *
 * The actual implementation is in index.ts which:
 * - Connects to RabbitMQ
 * - Consumes SMS messages from the notifications.sms queue
 * - Processes messages through SMSProcessor
 * - Uses multi-provider strategy for cost optimization
 */

require('./index');
