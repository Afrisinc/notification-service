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
import { prismaWrite, prismaRead } from '@shared/database';
import { accountRepository } from '../repositories/account.repository';

/**
 * RabbitMQ Configuration for Email Notifications
 */
const QUEUE_CONFIG = {
  QUEUE_NAME: 'notifications.email',
  EXCHANGE_NAME: 'notifications',
  ROUTING_KEY: 'send_message.email',
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
 * Resolve account for notification processing
 * Uses default Afrisinc Auth account if not specified
 *
 * @returns Account ID
 * @throws Error if account cannot be resolved
 */
const resolveTenant = async (): Promise<string> => {
  try {
    // Get or create default Afrisinc system account
    let account = await prismaRead.account.findUnique({
      where: { id: 'afrisinc-auth-account' },
      select: { id: true },
    });

    if (!account) {
      logger.info('Creating default Afrisinc Auth account for notifications...');

      // Ensure system user exists
      const systemUser = await prismaWrite.user.upsert({
        where: { email: 'system@afrisinc.com' },
        update: {},
        create: {
          email: 'system@afrisinc.com',
          password_hash: 'system',
          firstName: 'System',
          lastName: 'Auth',
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      // Ensure organization exists
      const org = await prismaWrite.organization.upsert({
        where: { id: 'afrisinc-auth-org' },
        update: {},
        create: {
          id: 'afrisinc-auth-org',
          name: 'Afrisinc Auth System',
          country: 'NG',
        },
        select: { id: true },
      });

      const createdAccount = await accountRepository.create({
        id: 'afrisinc-auth-account',
        type: 'ORGANIZATION',
        owner_user_id: systemUser.id,
        organization_id: org.id,
      });
      account = { id: createdAccount.id };
    }

    return account.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Failed to resolve account for notifications');
    throw new Error('Account resolution failed');
  }
};
