export interface NotificationEvent {
  id: string;
  tenantId: string;
  recipientId: string;
  channel: 'email' | 'sms' | 'inapp';
  subject?: string;
  body: string;
  recipient: string;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Notification {
  id: string;
  tenantId: string;
  recipientId: string;
  channel: string;
  status: string;
  createdAt: Date;
}
