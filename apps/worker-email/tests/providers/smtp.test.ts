import pino from "pino";
import nodemailer from "nodemailer";
import { SMTPProvider } from "../../src/providers/smtp";
import { getConfig } from "@afrisinc-notify/config";

jest.mock("nodemailer");
jest.mock("@afrisinc-notify/config");

describe("SMTPProvider", () => {
  let provider: SMTPProvider;
  let logger: pino.Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = pino({ level: "silent" });

    (getConfig as jest.Mock).mockReturnValue({
      SMTP_HOST: "smtp.test.com",
      SMTP_PORT: 587,
      SMTP_USER: "test@test.com",
      SMTP_PASSWORD: "password",
      SMTP_FROM: "noreply@test.com",
    });

    provider = new SMTPProvider(logger);
  });

  describe("send", () => {
    it("should send email successfully", async () => {
      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: "<msg-123@test.com>",
      });

      (nodemailer.createTransport as jest.Mock).mockReturnValue({
        sendMail: mockSendMail,
      });

      provider = new SMTPProvider(logger);

      const email = {
        id: "notif-1",
        tenantId: "tenant-1",
        recipientId: "user-1",
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "Test Body",
        html: "<p>Test Body</p>",
        createdAt: new Date(),
      };

      const result = await provider.send(email);

      expect(result.messageId).toBe("<msg-123@test.com>");
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "noreply@test.com",
          to: "recipient@example.com",
          subject: "Test Subject",
          text: "Test Body",
          html: "<p>Test Body</p>",
        }),
      );
    });

    it("should throw error if email sending fails", async () => {
      const mockSendMail = jest
        .fn()
        .mockRejectedValue(new Error("SMTP connection failed"));

      (nodemailer.createTransport as jest.Mock).mockReturnValue({
        sendMail: mockSendMail,
      });

      provider = new SMTPProvider(logger);

      const email = {
        id: "notif-2",
        tenantId: "tenant-1",
        recipientId: "user-1",
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "Test Body",
        createdAt: new Date(),
      };

      await expect(provider.send(email)).rejects.toThrow(
        "SMTP connection failed",
      );
    });

    it("should use default sender if SMTP_FROM not configured", async () => {
      (getConfig as jest.Mock).mockReturnValue({
        SMTP_HOST: "smtp.test.com",
        SMTP_PORT: 587,
        SMTP_USER: "test@test.com",
        SMTP_PASSWORD: "password",
      });

      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: "<msg-456@test.com>",
      });

      (nodemailer.createTransport as jest.Mock).mockReturnValue({
        sendMail: mockSendMail,
      });

      provider = new SMTPProvider(logger);

      const email = {
        id: "notif-3",
        tenantId: "tenant-1",
        recipientId: "user-1",
        to: "recipient@example.com",
        subject: "Test Subject",
        body: "Test Body",
        createdAt: new Date(),
      };

      await provider.send(email);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "noreply@notification.local",
        }),
      );
    });
  });

  describe("constructor", () => {
    it("should throw error if SMTP_HOST is not configured", () => {
      (getConfig as jest.Mock).mockReturnValue({
        SMTP_PORT: 587,
      });

      expect(() => new SMTPProvider(logger)).toThrow(
        "SMTP_HOST and SMTP_PORT are required",
      );
    });

    it("should set secure to true for port 465", () => {
      (getConfig as jest.Mock).mockReturnValue({
        SMTP_HOST: "smtp.test.com",
        SMTP_PORT: 465,
      });

      const mockCreateTransport = jest.fn();
      (nodemailer.createTransport as jest.Mock) = mockCreateTransport;

      provider = new SMTPProvider(logger);

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: true,
        }),
      );
    });
  });
});
