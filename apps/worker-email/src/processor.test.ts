import pino from 'pino';
import { EmailProcessor } from './processor';
import { db } from '@afrisinc-notify/db';
import { getConfig } from '@afrisinc-notify/config';

// Mock dependencies
jest.mock('@afrisinc-notify/db');
jest.mock('@afrisinc-notify/config');
jest.mock('./providers/smtp');
jest.mock('./providers/sendgrid');

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let logger: pino.Logger;
  const mockConfig = {
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.test.com',
    SMTP_PORT: 587,
    SMTP_USER: 'test@test.com',
    SMTP_PASSWORD: 'password',
    SMTP_FROM: 'noreply@test.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logger = pino({ level: 'silent' });
    (getConfig as jest.Mock).mockReturnValue(mockConfig);
    processor = new EmailProcessor(logger);
  });

  describe('process', () => {
    it('should process email and update notification status to sent', async () => {
      const email = {
        id: 'notif-123',
        tenantId: 'tenant-1',
        recipientId: 'user-1',
        to: 'user@example.com',
        subject: 'Test Email',
        body: 'Test body',
        html: '<p>Test body</p>',
        priority: 'normal' as const,
        createdAt: new Date(),
      };

      const mockUpdate = jest.fn().mockResolvedValue({
        id: email.id,
        status: 'sent',
      });

      (db.notification.update as jest.Mock) = mockUpdate;

      // Mock SMTP provider
      const SMTPProvider = require('./providers/smtp').SMTPProvider;
      const mockSend = jest.fn().mockResolvedValue({ messageId: 'msg-123' });
      SMTPProvider.prototype.send = mockSend;

      await processor.process(email);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: email.id },
        data: expect.objectContaining({
          status: 'sent',
          externalId: 'msg-123',
        }),
      });
    });

    it('should handle error and update notification status to failed', async () => {
      const email = {
        id: 'notif-456',
        tenantId: 'tenant-1',
        recipientId: 'user-1',
        to: 'user@example.com',
        subject: 'Test Email',
        body: 'Test body',
        createdAt: new Date(),
      };

      const mockUpdate = jest.fn().mockResolvedValue({
        id: email.id,
        status: 'failed',
      });

      (db.notification.update as jest.Mock) = mockUpdate;

      // Mock SMTP provider to throw error
      const SMTPProvider = require('./providers/smtp').SMTPProvider;
      const mockSend = jest.fn().mockRejectedValue(new Error('SMTP Error'));
      SMTPProvider.prototype.send = mockSend;

      await expect(processor.process(email)).rejects.toThrow('SMTP Error');

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: email.id },
        data: expect.objectContaining({
          status: 'failed',
          failureReason: 'SMTP Error',
        }),
      });
    });

    it('should use SendGrid provider when configured', async () => {
      (getConfig as jest.Mock).mockReturnValue({
        EMAIL_PROVIDER: 'sendgrid',
        SENDGRID_API_KEY: 'sg-test-key',
      });

      const newProcessor = new EmailProcessor(logger);

      const email = {
        id: 'notif-789',
        tenantId: 'tenant-1',
        recipientId: 'user-1',
        to: 'user@example.com',
        subject: 'Test Email',
        body: 'Test body',
        createdAt: new Date(),
      };

      const mockUpdate = jest.fn().mockResolvedValue({
        id: email.id,
        status: 'sent',
      });

      (db.notification.update as jest.Mock) = mockUpdate;

      // Mock SendGrid provider
      const SendGridProvider = require('./providers/sendgrid').SendGridProvider;
      const mockSend = jest.fn().mockResolvedValue({ messageId: 'sg-msg-123' });
      SendGridProvider.prototype.send = mockSend;

      await newProcessor.process(email);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: email.id },
        data: expect.objectContaining({
          status: 'sent',
          externalId: 'sg-msg-123',
        }),
      });
    });
  });
});
