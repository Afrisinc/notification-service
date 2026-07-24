export type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH' | 'WHATSAPP';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface QueueMessageAttachment {
  filename: string;
  url?: string;
  content?: string;
  contentType: string;
}

export interface QueueMessage {
  notificationId: string;
  tenantId: string;
  appId?: string;
  channel: NotificationChannel;
  recipient: string;
  templateCode?: string;
  templateId?: string;
  payload: Record<string, any>;
  priority: NotificationPriority;
  timestamp: Date;
  subject?: string;
  body?: string;
  fromEmail?: string;
  fromName?: string;
  attachments?: QueueMessageAttachment[];
}

export interface QueueEnvelope {
  msg: QueueMessage;
  dateProduced: string;
}
