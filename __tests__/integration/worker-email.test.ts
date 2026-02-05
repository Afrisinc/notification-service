import { Queue } from 'bull';
import pino from 'pino';
import { EmailProcessor } from '../../apps/worker-email/src/processor';
import { db } from '@afrisinc-notify/db';
import { getConfig } from '@afrisinc-notify/config';

// Mock dependencies
jest.mock('@afrisinc-notify/db');
jest.mock('@afrisinc-notify/config');
jest.mock('../../apps/worker-email/src/providers/smtp');
jest.mock('../../apps/worker-email/src/providers/sendgrid');

describe('Email Worker Integration Tests', () => {
  let logger: pino.Logger;
  let processor: EmailProcessor;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    (getConfig as jest.Mock).mockReturnValue({
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.test.com',
      SMTP_PORT: 587,
      SMTP_USER: 'test@test.com',
      SMTP_PASSWORD: 'password',
      SMTP_FROM: 'noreply@test.com',
      REDIS_URL: 'redis://localhost:6379',
    });
    processor = new EmailProcessor(logger);
  });

  describe('Email Processing Workflow', () => {
    it('should complete full email notification workflow', async () => {
      const notificationId = 'notif-integration-1';
      const tenantId = 'tenant-integration-1';
      const recipientId = 'user-integration-1';

      const emailData = {
        id: notificationId,
        tenantId,
        recipientId,
        to: 'integration@example.com',
        subject: 'Integration Test Email',
        body: 'This is an integration test',
        html: '<p>This is an integration test</p>',
        priority: 'normal' as const,
        createdAt: new Date(),
      };

      const mockDbUpdate = jest.fn().mockResolvedValue({
        id: notificationId,
        status: 'sent',
        sentAt: new Date(),
        externalId: 'msg-integration-1',
      });

      (db.notification.update as jest.Mock) = mockDbUpdate;

      // Mock provider send
      const SMTPProvider = require('../../apps/worker-email/src/providers/smtp').SMTPProvider;
      SMTPProvider.prototype.send = jest
        .fn()
        .mockResolvedValue({ messageId: 'msg-integration-1' });

      // Process email
      await processor.process(emailData);

      // Verify database was updated with success
      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: expect.objectContaining({
          status: 'sent',
          externalId: 'msg-integration-1',
        }),
      });
    });

    it('should handle batch email processing', async () => {
      const emails = Array.from({ length: 3 }, (_, i) => ({
        id: `notif-batch-${i}`,
        tenantId: 'tenant-batch-1',
        recipientId: `user-batch-${i}`,
        to: `user${i}@example.com`,
        subject: 'Batch Test Email',
        body: 'This is a batch test',
        createdAt: new Date(),
      }));

      const mockDbUpdate = jest.fn().mockResolvedValue({});
      (db.notification.update as jest.Mock) = mockDbUpdate;

      const SMTPProvider = require('../../apps/worker-email/src/providers/smtp').SMTPProvider;
      SMTPProvider.prototype.send = jest
        .fn()
        .mockResolvedValue({ messageId: 'msg-batch' });

      // Process all emails
      await Promise.all(emails.map(email => processor.process(email)));

      // Verify all were processed
      expect(mockDbUpdate).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const successEmail = {
        id: 'notif-success-1',
        tenantId: 'tenant-mixed-1',
        recipientId: 'user-success-1',
        to: 'success@example.com',
        subject: 'Success Email',
        body: 'This should succeed',
        createdAt: new Date(),
      };

      const failureEmail = {
        id: 'notif-failure-1',
        tenantId: 'tenant-mixed-1',
        recipientId: 'user-failure-1',
        to: 'invalid-email',
        subject: 'Failure Email',
        body: 'This should fail',
        createdAt: new Date(),
      };

      const mockDbUpdate = jest.fn()
        .mockResolvedValueOnce({ status: 'sent' })
        .mockResolvedValueOnce({ status: 'failed' });

      (db.notification.update as jest.Mock) = mockDbUpdate;

      const SMTPProvider = require('../../apps/worker-email/src/providers/smtp').SMTPProvider;
      let callCount = 0;
      SMTPProvider.prototype.send = jest.fn().mockImplementation(() => {
        if (callCount++ === 0) {
          return Promise.resolve({ messageId: 'msg-success' });
        }
        return Promise.reject(new Error('Invalid email format'));
      });

      // Process success email
      await processor.process(successEmail);
      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'notif-success-1' },
        data: expect.objectContaining({
          status: 'sent',
        }),
      });

      // Process failure email
      await expect(processor.process(failureEmail)).rejects.toThrow();
      expect(mockDbUpdate).toHaveBeenCalledWith({
        where: { id: 'notif-failure-1' },
        data: expect.objectContaining({
          status: 'failed',
        }),
      });
    });

    it('should support multiple email providers in sequence', async () => {
      const smtpEmail = {
        id: 'notif-smtp-1',
        tenantId: 'tenant-multi-1',
        recipientId: 'user-smtp-1',
        to: 'smtp@example.com',
        subject: 'SMTP Email',
        body: 'Send via SMTP',
        createdAt: new Date(),
      };

      const sendgridEmail = {
        id: 'notif-sg-1',
        tenantId: 'tenant-multi-1',
        recipientId: 'user-sg-1',
        to: 'sendgrid@example.com',
        subject: 'SendGrid Email',
        body: 'Send via SendGrid',
        createdAt: new Date(),
      };

      const mockDbUpdate = jest.fn().mockResolvedValue({});
      (db.notification.update as jest.Mock) = mockDbUpdate;

      // Process with SMTP
      const SMTPProvider = require('../../apps/worker-email/src/providers/smtp').SMTPProvider;
      SMTPProvider.prototype.send = jest
        .fn()
        .mockResolvedValue({ messageId: 'msg-smtp-1' });

      await processor.process(smtpEmail);

      // Switch to SendGrid
      (getConfig as jest.Mock).mockReturnValue({
        EMAIL_PROVIDER: 'sendgrid',
        SENDGRID_API_KEY: 'sg-key',
      });

      const newProcessor = new EmailProcessor(logger);
      const SendGridProvider = require('../../apps/worker-email/src/providers/sendgrid').SendGridProvider;
      SendGridProvider.prototype.send = jest
        .fn()
        .mockResolvedValue({ messageId: 'msg-sg-1' });

      await newProcessor.process(sendgridEmail);

      // Verify both were processed
      expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    });
  });
});
