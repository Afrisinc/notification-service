/**
 * Email Notifications Consumer
 *
 * RabbitMQ handler for email notification messages
 * Listens to notifications exchange with send_message routing key
 * Processes messages and saves to database with status tracking
 */

import { Message, Channel } from 'amqplib';
import { logger } from '../config/logger';
import { RabbitMQExchange } from '../utils/rabbitmq';
import { notificationConsumer } from './notification.consumer';
import { db } from '@shared/db';

/**
 * RabbitMQ Configuration for Email Notifications
 */
const QUEUE_CONFIG = {
  QUEUE_NAME: 'notifications.email',
  EXCHANGE_NAME: 'notifications',
  ROUTING_KEY: 'send_message',
};

/**
 * Email Notifications Consumer
 * Sets up RabbitMQ consumer for email notifications from Auth Service
 *
 * @throws Error if consumer setup fails
 */
export const emailConsumer = async (): Promise<void> => {
  try {
    logger.info(
      {
        queue: QUEUE_CONFIG.QUEUE_NAME,
        exchange: QUEUE_CONFIG.EXCHANGE_NAME,
        routingKey: QUEUE_CONFIG.ROUTING_KEY,
      },
      '🔌 Setting up email consumer...'
    );

    // Register consumer with RabbitMQ
    await RabbitMQExchange.messageConsumer(
      QUEUE_CONFIG.QUEUE_NAME,
      handleEmailMessage,
      QUEUE_CONFIG.ROUTING_KEY,
      QUEUE_CONFIG.EXCHANGE_NAME
    );

    logger.info(
      {
        queue: QUEUE_CONFIG.QUEUE_NAME,
        exchange: QUEUE_CONFIG.EXCHANGE_NAME,
      },
      '✅ Email consumer started successfully'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, '❌ Failed to start email consumer');
    throw error;
  }
};

/**
 * Handle incoming email message from RabbitMQ
 *
 * Message format from Auth Service:
 * ```json
 * {
 *   "msg": {
 *     "channel": "EMAIL",
 *     "recipient": "user@example.com",
 *     "templateCode": "AUTH_VERIFY_EMAIL",
 *     "payload": {
 *       "firstName": "John",
 *       "verificationUrl": "https://...",
 *       "companyName": "Afrisinc",
 *       "supportEmail": "support@afrisinc.com"
 *     },
 *     "priority": "NORMAL"
 *   },
 *   "dateProduced": "2026-03-01T..."
 * }
 * ```
 *
 * @param msg - RabbitMQ message
 * @param channel - RabbitMQ channel for acknowledgment
 */
const handleEmailMessage = async (msg: Message, channel: Channel): Promise<void> => {
  const startTime = Date.now();

  try {
    if (!msg) {
      logger.warn('Received null message from queue');
      return;
    }

    // Parse message content
    const content = JSON.parse(msg.content.toString());
    const emailData = content.msg;
    const dateProduced = content.dateProduced;

    const processingTime = Date.now() - new Date(dateProduced).getTime();

    logger.debug(
      {
        templateCode: emailData.templateCode,
        channel: emailData.channel,
        recipient: emailData.recipient,
        processingDelayMs: processingTime,
      },
      '📨 Processing email message from queue'
    );

    // Validate message structure
    validateEmailMessage(emailData);

    // Resolve tenant ID
    const tenantId = await resolveTenant();

    // Process notification via consumer
    const notification = await notificationConsumer.processNotification(
      {
        channel: emailData.channel,
        recipient: emailData.recipient,
        templateCode: emailData.templateCode,
        payload: emailData.payload || {},
        priority: emailData.priority || 'NORMAL',
      },
      tenantId
    );

    // Acknowledge successful processing
    channel.ack(msg);

    const totalTime = Date.now() - startTime;
    logger.info(
      {
        notificationId: notification.id,
        templateCode: emailData.templateCode,
        recipient: emailData.recipient,
        processingTimeMs: totalTime,
      },
      '✅ Email notification processed and acknowledged'
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const totalTime = Date.now() - startTime;

    logger.error(
      {
        error: errorMessage,
        processingTimeMs: totalTime,
      },
      '❌ Failed to process email message, rejecting for requeue'
    );

    // Reject and requeue for retry
    channel.nack(msg, false, true);
  }
};

/**
 * Validate email message structure
 *
 * @param emailData - Email notification data
 * @throws Error if validation fails
 */
const validateEmailMessage = (emailData: any): void => {
  const requiredFields = ['channel', 'recipient', 'templateCode'];

  for (const field of requiredFields) {
    if (!emailData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  const validChannels = ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'];
  if (!validChannels.includes(emailData.channel)) {
    throw new Error(`Invalid channel: ${emailData.channel}`);
  }

  const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
  if (emailData.priority && !validPriorities.includes(emailData.priority)) {
    throw new Error(`Invalid priority: ${emailData.priority}`);
  }

  if (!emailData.payload || typeof emailData.payload !== 'object') {
    throw new Error('Payload must be a valid object');
  }
};

/**
 * Resolve tenant for notification processing
 * Uses default Afrisinc Auth tenant if not specified
 *
 * @returns Tenant ID
 * @throws Error if tenant cannot be resolved
 */
const resolveTenant = async (): Promise<string> => {
  try {
    // Try to get or create default Afrisinc Auth tenant
    let tenant = await db.tenant.findUnique({
      where: { code: 'afrisinc-auth' },
      select: { id: true },
    });

    if (!tenant) {
      logger.info('Creating default Afrisinc Auth tenant for notifications...');
      tenant = await db.tenant.create({
        data: {
          code: 'afrisinc-auth',
          name: 'Afrisinc Auth',
          accountId: 'system-afrisinc',
          accountType: 'ORGANIZATION',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    }

    return tenant.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Failed to resolve tenant for notifications');
    throw new Error('Tenant resolution failed');
  }
};
