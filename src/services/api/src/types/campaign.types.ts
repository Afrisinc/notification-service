/**
 * Campaign DTOs (Data Transfer Objects)
 * Supports both Template Mode and Direct Content Mode for all channels
 */

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL-SPECIFIC CONTENT INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/** EMAIL channel direct content */
export interface EmailContent {
  subject: string;
  html_content: string;
}

/** SMS channel direct content */
export interface SmsContent {
  text_content: string;
}

/** PUSH channel direct content */
export interface PushContent {
  push_title: string;
  push_body: string;
  push_image_url?: string;
  push_action_url?: string;
  push_data?: Record<string, any>;
}

/** IN_APP channel direct content */
export interface InAppContent {
  inapp_title: string;
  inapp_body: string;
  inapp_image_url?: string;
  inapp_action_url?: string;
  inapp_action_text?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE CAMPAIGN DTO
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateCampaignDto {
  name: string;
  channel: string;

  // ─────────────────────────────────────────────────────────────────────────
  // CONTENT MODE: Either templateId OR channel-specific direct content
  // ─────────────────────────────────────────────────────────────────────────

  /** Template mode: provide templateId */
  templateId?: string;

  /** EMAIL direct content */
  subject?: string;
  html_content?: string;

  /** SMS direct content */
  text_content?: string;

  /** PUSH direct content */
  push_title?: string;
  push_body?: string;
  push_image_url?: string;
  push_action_url?: string;
  push_data?: Record<string, any>;

  /** IN_APP direct content */
  inapp_title?: string;
  inapp_body?: string;
  inapp_image_url?: string;
  inapp_action_url?: string;
  inapp_action_text?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // RECIPIENT TARGETING
  // ─────────────────────────────────────────────────────────────────────────
  recipientType?: string;
  recipientCount?: number;
  recipientTags?: string[];
  recipientSegment?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // CAMPAIGN SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  status?: string;
  scheduledAt?: string;
  metadata?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE CAMPAIGN DTO
// ═══════════════════════════════════════════════════════════════════════════

export interface UpdateCampaignDto {
  name?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // DIRECT CONTENT FIELDS (can be updated for draft campaigns)
  // ─────────────────────────────────────────────────────────────────────────

  /** EMAIL direct content */
  subject?: string;
  html_content?: string;

  /** SMS direct content */
  text_content?: string;

  /** PUSH direct content */
  push_title?: string;
  push_body?: string;
  push_image_url?: string;
  push_action_url?: string;
  push_data?: Record<string, any>;

  /** IN_APP direct content */
  inapp_title?: string;
  inapp_body?: string;
  inapp_image_url?: string;
  inapp_action_url?: string;
  inapp_action_text?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // RECIPIENT TARGETING
  // ─────────────────────────────────────────────────────────────────────────
  recipientType?: string;
  recipientCount?: number;
  recipientTags?: string[];
  recipientSegment?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // CAMPAIGN SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  status?: string;
  scheduledAt?: string;
  metadata?: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════════════════
// OTHER CAMPAIGN DTOs
// ═══════════════════════════════════════════════════════════════════════════

export interface SendCampaignDto {
  dryRun?: boolean;
}

export interface ScheduleCampaignDto {
  scheduledAt: string;
}

export interface DuplicateCampaignDto {
  newName: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN RESPONSE
// ═══════════════════════════════════════════════════════════════════════════

export interface CampaignResponse {
  id: string;
  appId: string;
  name: string;
  channel: string;

  // ─────────────────────────────────────────────────────────────────────────
  // CONTENT (Template mode OR Direct content mode)
  // ─────────────────────────────────────────────────────────────────────────
  templateId?: string;

  /** EMAIL content */
  subject?: string;
  htmlContent?: string;

  /** SMS content */
  textContent?: string;

  /** PUSH content */
  pushTitle?: string;
  pushBody?: string;
  pushImageUrl?: string;
  pushActionUrl?: string;
  pushData?: Record<string, any>;

  /** IN_APP content */
  inappTitle?: string;
  inappBody?: string;
  inappImageUrl?: string;
  inappActionUrl?: string;
  inappActionText?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // RECIPIENT & STATUS
  // ─────────────────────────────────────────────────────────────────────────
  recipientType: string;
  recipientCount: number;
  status: string;

  // ─────────────────────────────────────────────────────────────────────────
  // METRICS
  // ─────────────────────────────────────────────────────────────────────────
  sentCount: number;
  deliveredCount: number;
  failedCount: number;

  // ─────────────────────────────────────────────────────────────────────────
  // TIMESTAMPS
  // ─────────────────────────────────────────────────────────────────────────
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Channel types */
export type CampaignChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';

/** Required fields per channel for direct content mode */
export const CHANNEL_REQUIRED_FIELDS: Record<CampaignChannel, string[]> = {
  EMAIL: ['subject', 'html_content'],
  SMS: ['text_content'],
  PUSH: ['push_title', 'push_body'],
  IN_APP: ['inapp_title', 'inapp_body'],
};
