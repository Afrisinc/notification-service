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
  cc?: string[];
  attachments?: QueueMessageAttachment[];
  /** Thread-reply headers (set by inbox.service.ts's replyToThread) - passed through to the SMTP provider. */
  messageIdHeader?: string;
  inReplyToMessageId?: string;
  referencesHeader?: string[];
  threadReplyToAddress?: string;
  /**
   * Send directly through this domain/selector's DKIM key, bypassing the
   * per-App AppEmailProvider lookup entirely - used by org-level inbox
   * sends that have no App at all (see inbox.service.ts#composeThread).
   */
  directSend?: { fromEmail: string; fromName?: string; domain: string; selector: string };
}

export interface QueueEnvelope {
  msg: QueueMessage;
  dateProduced: string;
}
