/**
 * Guest Queue Publisher
 * In-memory queue implementation for local development and testing
 *
 * Features:
 * - No external dependencies required
 * - Perfect for development and testing
 * - All messages stored in memory
 * - Configurable retention/cleanup
 *
 * Production: Use RabbitMQ, Redis, or other real queue providers
 */

import { logger } from '../../../config/logger';
import { IQueuePublisher, QueueMessage } from '../publisher.interface';

interface StoredMessage {
  message: QueueMessage;
  publishedAt: Date;
  status: 'pending' | 'processed';
}

export class GuestQueuePublisher implements IQueuePublisher {
  private messages: Map<string, StoredMessage> = new Map();
  private messageCount: number = 0;
  private maxRetentionMs: number;

  constructor(options?: { maxRetentionMs?: number; maxMessages?: number }) {
    this.maxRetentionMs = options?.maxRetentionMs || 24 * 60 * 60 * 1000; // 24 hours default
    this.startCleanupInterval();
  }

  async publish(message: QueueMessage): Promise<void> {
    const messageId = `${message.notificationId}-${Date.now()}`;

    this.messages.set(messageId, {
      message,
      publishedAt: new Date(),
      status: 'pending',
    });

    this.messageCount++;

    logger.info(
      {
        messageId,
        notificationId: message.notificationId,
        tenantId: message.tenantId,
        channel: message.channel,
        recipient: message.recipient,
        queueSize: this.messages.size,
        totalProcessed: this.messageCount,
      },
      '📨 [GUEST QUEUE] Message published to in-memory queue',
    );

    // For development, log the full message structure
    if (process.env.NODE_ENV === 'development') {
      logger.debug({ message }, '[GUEST QUEUE] Full message details');
    }
  }

  async healthCheck(): Promise<boolean> {
    // Guest queue is always healthy
    return true;
  }

  getName(): string {
    return 'GuestQueuePublisher';
  }

  /**
   * Get queue statistics (useful for debugging)
   */
  getStats() {
    return {
      name: this.getName(),
      queueSize: this.messages.size,
      totalPublished: this.messageCount,
      oldestMessage: this.getOldestMessage(),
      newestMessage: this.getNewestMessage(),
    };
  }

  /**
   * Get all messages (for testing/debugging)
   */
  getAllMessages(): QueueMessage[] {
    return Array.from(this.messages.values()).map((sm) => sm.message);
  }

  /**
   * Clear all messages (useful for testing)
   */
  clearAll(): void {
    const count = this.messages.size;
    this.messages.clear();
    logger.info({ clearedCount: count }, '[GUEST QUEUE] All messages cleared');
  }

  private getOldestMessage(): QueueMessage | null {
    let oldest: StoredMessage | null = null;
    let oldestTime = Infinity;

    for (const stored of this.messages.values()) {
      const time = stored.publishedAt.getTime();
      if (time < oldestTime) {
        oldest = stored;
        oldestTime = time;
      }
    }

    return oldest?.message || null;
  }

  private getNewestMessage(): QueueMessage | null {
    let newest: StoredMessage | null = null;
    let newestTime = -Infinity;

    for (const stored of this.messages.values()) {
      const time = stored.publishedAt.getTime();
      if (time > newestTime) {
        newest = stored;
        newestTime = time;
      }
    }

    return newest?.message || null;
  }

  /**
   * Start periodic cleanup of old messages
   */
  private startCleanupInterval(): void {
    if (process.env.NODE_ENV === 'test') {
      return; // Don't cleanup during tests
    }

    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, stored] of this.messages.entries()) {
        if (now - stored.publishedAt.getTime() > this.maxRetentionMs) {
          this.messages.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug(
          { cleaned, remaining: this.messages.size },
          '[GUEST QUEUE] Cleanup completed',
        );
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  async disconnect(): Promise<void> {
    this.messages.clear();
    logger.info('[GUEST QUEUE] Disconnected and cleared all messages');
  }
}
