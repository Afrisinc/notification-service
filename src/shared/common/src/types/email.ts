export interface EmailAttachment {
  filename: string;
  url?: string;
  content?: string;
  contentType: string;
}

export interface EmailNotification {
  id: string;
  tenantId: string;
  recipientId: string;
  appId?: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  name: string;
  send(email: EmailNotification): Promise<{ messageId: string }>;
}
