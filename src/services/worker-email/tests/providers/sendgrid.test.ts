import pino from 'pino';
import sgMail from '@sendgrid/mail';
import { SendGridProvider } from '../../src/providers/sendgrid';
import { getConfig } from '@shared/config';

jest.mock('@sendgrid/mail');
jest.mock('@shared/config');

describe('SendGridProvider', () => {
  let provider: SendGridProvider;
  let logger: pino.Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = pino({ level: 'silent' });

    (getConfig as jest.Mock).mockReturnValue({
      SENDGRID_API_KEY: 'sg-test-key',
      SMTP_FROM: 'noreply@test.com',
    });

    provider = new SendGridProvider(logger);
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue([
        {
          statusCode: 202,
          headers: {
            'x-message-id': 'sg-msg-123',
          },
        },
      ]);

      (sgMail.send as jest.Mock) = mockSend;

      const email = {
        id: 'notif-1',
        tenantId: 'tenant-1',
        recipientId: 'user-1',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        html: '<p>Test Body</p>',
        createdAt: new Date(),
      };

      const result = await provider.send(email);

      expect(result.messageId).toBe('sg-msg-123');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@test.com',
          to: 'recipient@example.com',
          subject: 'Test Subject',
          text: 'Test Body',
          html: '<p>Test Body</p>',
        })
      );
    });

    it('should handle SendGrid API errors', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('SendGrid API Error'));

      (sgMail.send as jest.Mock) = mockSend;

      const email = {
        id: 'notif-2',
        tenantId: 'tenant-1',
        recipientId: 'user-1',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        createdAt: new Date(),
      };

      await expect(provider.send(email)).rejects.toThrow('SendGrid API Error');
    });

    it('should use default sender if SMTP_FROM not configured', async () => {
      (getConfig as jest.Mock).mockReturnValue({
        SENDGRID_API_KEY: 'sg-test-key',
      });

      const mockSend = jest.fn().mockResolvedValue([
        {
          statusCode: 202,
          headers: {
            'x-message-id': 'sg-msg-456',
          },
        },
      ]);

      (sgMail.send as jest.Mock) = mockSend;

      provider = new SendGridProvider(logger);

      const email = {
        id: 'notif-3',
        tenantId: 'tenant-1',
        recipientId: 'user-1',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
        createdAt: new Date(),
      };

      await provider.send(email);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@notification.local',
        })
      );
    });
  });

  describe('constructor', () => {
    it('should throw error if SENDGRID_API_KEY is not configured', () => {
      (getConfig as jest.Mock).mockReturnValue({});

      expect(() => new SendGridProvider(logger)).toThrow('SENDGRID_API_KEY is required');
    });

    it('should set SendGrid API key on initialization', () => {
      const mockSetApiKey = jest.fn();
      (sgMail.setApiKey as jest.Mock) = mockSetApiKey;

      const config = {
        SENDGRID_API_KEY: 'test-key-123',
      };
      (getConfig as jest.Mock).mockReturnValue(config);

      provider = new SendGridProvider(logger);

      expect(mockSetApiKey).toHaveBeenCalledWith('test-key-123');
    });
  });
});
