export interface EmailNotification {
  id: string;
  tenantId: string;
  recipientId: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  priority?: "low" | "normal" | "high";
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface EmailProvider {
  name: string;
  send(email: EmailNotification): Promise<{ messageId: string }>;
}
