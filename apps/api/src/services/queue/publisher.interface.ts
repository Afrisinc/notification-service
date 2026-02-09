/**
 * Queue Publisher Interface
 * Contract for all queue publisher implementations
 *
 * This interface defines the contract that all queue publishers must implement,
 * allowing for multiple implementations (RabbitMQ, Redis, AWS SQS, etc.)
 */

export interface QueueMessage {
  notificationId: string;
  tenantId: string;
  channel: 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH' | 'WHATSAPP';
  recipient: string;
  templateCode: string;
  payload: Record<string, any>;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  timestamp: Date;
}

export interface IQueuePublisher {
  /**
   * Publish a message to the queue
   * @param message - The message to publish
   * @throws Error if publishing fails
   */
  publish(message: QueueMessage): Promise<void>;

  /**
   * Health check for the queue publisher
   * @returns true if healthy, false otherwise
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get publisher name for logging/monitoring
   */
  getName(): string;

  /**
   * Graceful shutdown
   */
  disconnect?(): Promise<void>;
}

/**
 * Queue Publisher Factory Type
 * Used to create instances of queue publishers
 */
export type QueuePublisherFactory = () => Promise<IQueuePublisher>;
