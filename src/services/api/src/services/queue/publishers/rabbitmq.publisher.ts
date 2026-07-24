import type { ConfirmChannel } from 'amqplib';
import { RabbitPublisher, type QueueMessage } from '@shared/queue';
import { logger } from '../../../config/logger';
import { IQueuePublisher } from '../publisher.interface';

export class RabbitMQPublisher implements IQueuePublisher {
  private readonly publisher: RabbitPublisher;

  constructor(url: string) {
    this.publisher = new RabbitPublisher({ url, logger });
  }

  async connect(): Promise<void> {
    await this.publisher.connect();
  }

  async publish(message: QueueMessage): Promise<void> {
    await this.publisher.publish(message);
  }

  async healthCheck(): Promise<boolean> {
    return this.publisher.healthCheck();
  }

  getName(): string {
    return this.publisher.getName();
  }

  getChannel(): ConfirmChannel | null {
    return this.publisher.getChannel();
  }

  async disconnect(): Promise<void> {
    await this.publisher.disconnect();
  }
}
