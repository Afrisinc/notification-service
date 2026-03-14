import { logger } from '../config/logger';
import { SendNotificationRequest, BulkSendRequest } from '../services/notify.service';

/**
 * Batch publish result
 */
export interface BatchPublishResult {
  published: number;
  failed: number;
  messageIds: string[];
  errors: Array<{ index: number; error: string; templateCode: string }>;
}

/**
 * Publish options
 */
export interface PublishOptions {
  delayMs?: number;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  maxRetries?: number;
  timeout?: number;
}

/**
 * Queue backend interface for abstraction
 */
export interface IQueueBackend {
  publish(message: any, options?: PublishOptions): Promise<string>;
  publishBatch(messages: any[], options?: PublishOptions): Promise<string[]>;
}

/**
 * Notification Publisher
 *
 * Handles publishing of notification messages to a queue backend.
 * Supports both single and batch operations with resilience.
 *
 * The publisher is backend-agnostic and works with any queue implementation
 * that conforms to the IQueueBackend interface (RabbitMQ, Redis, etc).
 *
 * @example
 * ```typescript
 * // Initialize with a queue backend
 * notificationPublisher.initialize(rabbitMQBackend);
 *
 * // Publish single notification
 * const messageId = await notificationPublisher.publish(tenantId, {
 *   channel: 'EMAIL',
 *   recipient: 'user@example.com',
 *   templateCode: 'AUTH_VERIFY_EMAIL',
 *   payload: { firstName: 'John', verificationUrl: '...' }
 * });
 *
 * // Publish with delay
 * await notificationPublisher.publishDelayed(tenantId, notification, 5000);
 *
 * // Publish batch
 * const result = await notificationPublisher.publishBatch(tenantId, {
 *   notifications: [notification1, notification2, ...]
 * });
 * ```
 */
export class NotificationPublisher {
  private queueBackend: IQueueBackend | null = null;

  /**
   * Initialize queue backend
   *
   * @param backend - Queue backend implementation
   * @throws Error if backend is null/undefined
   */
  initialize(backend: IQueueBackend): void {
    if (!backend) {
      throw new Error('Queue backend cannot be null');
    }
    this.queueBackend = backend;
    logger.info('Notification publisher initialized with queue backend');
  }

  /**
   * Publish single notification to queue
   *
   * @param tenantId - Tenant identifier
   * @param notification - Notification payload
   * @param options - Publishing options (delay, priority, retries)
   * @returns Message ID for tracking
   * @throws Error if validation fails or backend not initialized
   */
  async publish(tenantId: string, notification: SendNotificationRequest, options?: PublishOptions): Promise<string> {
    try {
      this.validateInitialization();
      this.validateNotification(notification);

      const messageId = this.generateMessageId();
      const envelope = this.createEnvelope(messageId, tenantId, notification);

      logger.debug(
        {
          messageId,
          tenantId,
          channel: notification.channel,
          templateCode: notification.templateCode,
          recipient: notification.recipient,
        },
        'Publishing notification to queue'
      );

      const publishedId = await this.queueBackend!.publish(envelope, {
        priority: notification.priority || 'NORMAL',
        ...options,
      });

      logger.info(
        {
          messageId,
          publishedId,
          tenantId,
          channel: notification.channel,
        },
        'Notification successfully published to queue'
      );

      return publishedId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          error: errorMessage,
          tenantId,
          templateCode: notification.templateCode,
        },
        'Failed to publish notification to queue'
      );
      throw error;
    }
  }

  /**
   * Publish batch of notifications to queue
   *
   * @param tenantId - Tenant identifier
   * @param batch - Batch request containing multiple notifications
   * @param options - Publishing options
   * @returns Results with published count, failed count, and message IDs
   */
  async publishBatch(tenantId: string, batch: BulkSendRequest, options?: PublishOptions): Promise<BatchPublishResult> {
    const results: BatchPublishResult = {
      published: 0,
      failed: 0,
      messageIds: [],
      errors: [],
    };

    if (!batch.notifications || batch.notifications.length === 0) {
      logger.warn({ tenantId }, 'Empty batch received for publishing');
      return results;
    }

    logger.info({ tenantId, count: batch.notifications.length }, 'Starting batch notification publishing');

    for (let i = 0; i < batch.notifications.length; i++) {
      try {
        const notification = batch.notifications[i];
        this.validateNotification(notification);

        const messageId = this.generateMessageId();
        const envelope = this.createEnvelope(messageId, tenantId, notification);

        const publishedId = await this.queueBackend!.publish(envelope, {
          priority: notification.priority || 'NORMAL',
          ...options,
        });

        results.published++;
        results.messageIds.push(publishedId);

        logger.debug({ index: i, messageId, publishedId, tenantId }, 'Published notification in batch');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed++;
        results.errors.push({
          index: i,
          error: errorMessage,
          templateCode: batch.notifications[i].templateCode,
        });

        logger.warn(
          {
            index: i,
            error: errorMessage,
            tenantId,
            templateCode: batch.notifications[i].templateCode,
          },
          'Failed to publish notification in batch'
        );
      }
    }

    logger.info(
      {
        tenantId,
        published: results.published,
        failed: results.failed,
        total: batch.notifications.length,
      },
      'Batch notification publishing completed'
    );

    return results;
  }

  /**
   * Publish with scheduled delay
   *
   * @param tenantId - Tenant identifier
   * @param notification - Notification payload
   * @param delayMs - Delay in milliseconds
   * @returns Message ID
   * @throws Error if delay is negative
   */
  async publishDelayed(tenantId: string, notification: SendNotificationRequest, delayMs: number): Promise<string> {
    if (delayMs < 0) {
      throw new Error('Delay cannot be negative');
    }
    return this.publish(tenantId, notification, { delayMs });
  }

  /**
   * Publish with specific priority
   *
   * @param tenantId - Tenant identifier
   * @param notification - Notification payload
   * @param priority - Message priority
   * @returns Message ID
   */
  async publishWithPriority(
    tenantId: string,
    notification: SendNotificationRequest,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  ): Promise<string> {
    return this.publish(tenantId, notification, { priority });
  }

  /**
   * Check if publisher is ready
   *
   * @returns true if backend is initialized
   */
  isReady(): boolean {
    return this.queueBackend !== null;
  }

  /**
   * Validate queue backend is initialized
   *
   * @throws Error if backend not initialized
   */
  private validateInitialization(): void {
    if (!this.queueBackend) {
      throw new Error('Queue backend not initialized. Call initialize() before publishing.');
    }
  }

  /**
   * Validate notification payload
   *
   * @param notification - Notification to validate
   * @throws Error if validation fails
   */
  private validateNotification(notification: SendNotificationRequest): void {
    const requiredFields = ['channel', 'recipient', 'templateCode'];
    for (const field of requiredFields) {
      if (!notification[field as keyof SendNotificationRequest]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const validChannels = ['EMAIL', 'SMS', 'IN_APP', 'PUSH', 'WHATSAPP'];
    if (!validChannels.includes(notification.channel)) {
      throw new Error(`Invalid channel: ${notification.channel}`);
    }

    if (typeof notification.payload !== 'object' || notification.payload === null) {
      throw new Error('Payload must be a valid object');
    }
  }

  /**
   * Generate unique message ID
   *
   * @returns Unique message identifier
   */
  private generateMessageId(): string {
    return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Create message envelope with metadata
   *
   * @param messageId - Unique message ID
   * @param tenantId - Tenant/Account identifier
   * @param notification - Notification payload
   * @returns Message envelope
   */
  private createEnvelope(messageId: string, tenantId: string, notification: SendNotificationRequest) {
    return {
      notificationId: messageId,
      accountId: tenantId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      ...notification,
    };
  }
}

export const notificationPublisher = new NotificationPublisher();
