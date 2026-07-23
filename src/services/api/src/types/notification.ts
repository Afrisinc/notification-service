export type Channel = 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH' | 'WHATSAPP';
export type NotificationStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'FAILED';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface EmailAttachment {
  filename: string;
  url?: string;
  content?: string;
  contentType?: string;
}

export interface SendNotificationRequest {
  channel: Channel;
  recipient: string;
  templateId?: string;
  app_id: string;
  payload: Record<string, any>;
  priority?: Priority;
  attachments?: EmailAttachment[];
}

export interface Notification {
  id: string;
  account_id: string;
  channel: Channel;
  recipient: string;
  templateId: string; // UUID for tracking which template version was used
  templateCode: string; // Code for reference
  status: NotificationStatus;
  priority: Priority;
  payload: Record<string, any>;
  retryCount?: number;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  createdAt: Date;
}

export interface BulkSendRequest {
  notifications: SendNotificationRequest[];
}

export interface BulkSendResponse {
  accepted: number;
  rejected: number;
  errors?: Array<{ index: number; error: string }>;
}
