import type { Channel, ConfirmChannel } from 'amqplib';

export type { QueueMessage, QueueMessageAttachment } from '@shared/queue';
import type { QueueMessage } from '@shared/queue';

export interface IQueuePublisher {
  publish(message: QueueMessage): Promise<void>;
  healthCheck(): Promise<boolean>;
  getName(): string;
  disconnect?(): Promise<void>;
  getChannel?(): Channel | ConfirmChannel | null;
}

export type QueuePublisherFactory = () => Promise<IQueuePublisher>;
