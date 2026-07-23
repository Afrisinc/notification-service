/**
 * Attachment Helper Utilities
 * Validates and processes email attachments (URL and Base64)
 */

export interface EmailAttachment {
  filename: string;
  url?: string;
  content?: string;
  contentType?: string;
}

export interface NormalizedAttachment {
  filename: string;
  url?: string;
  content?: string;
  contentType: string;
}

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE_BYTES = 25 * 1024 * 1024; // 25MB total
const MAX_ATTACHMENTS = 10;

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
  'text/html',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_TO_MIME[ext] || 'application/octet-stream';
}

export function validateAttachments(attachments: EmailAttachment[]): { valid: boolean; error?: string } {
  if (!attachments || attachments.length === 0) {
    return { valid: true };
  }

  if (attachments.length > MAX_ATTACHMENTS) {
    return { valid: false, error: `Maximum ${MAX_ATTACHMENTS} attachments allowed` };
  }

  let totalBase64Size = 0;

  for (const attachment of attachments) {
    if (!attachment.filename || attachment.filename.trim() === '') {
      return { valid: false, error: 'Attachment filename is required' };
    }

    if (attachment.filename.length > 255) {
      return { valid: false, error: 'Attachment filename must be 255 characters or less' };
    }

    // Must have either url or content
    if (!attachment.url && !attachment.content) {
      return { valid: false, error: `Attachment "${attachment.filename}" must have either url or content` };
    }

    // Cannot have both url and content
    if (attachment.url && attachment.content) {
      return { valid: false, error: `Attachment "${attachment.filename}" cannot have both url and content` };
    }

    // Validate URL
    if (attachment.url) {
      try {
        const url = new URL(attachment.url);
        if (url.protocol !== 'https:') {
          return { valid: false, error: `Attachment URL must use HTTPS: "${attachment.filename}"` };
        }
      } catch {
        return { valid: false, error: `Invalid attachment URL for "${attachment.filename}"` };
      }
    }

    // Validate Base64 content
    if (attachment.content) {
      if (!/^[A-Za-z0-9+/=]+$/.test(attachment.content)) {
        return { valid: false, error: `Invalid Base64 content for "${attachment.filename}"` };
      }

      const sizeBytes = Math.ceil((attachment.content.length * 3) / 4);
      if (sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
        return { valid: false, error: `Attachment "${attachment.filename}" exceeds 10MB limit` };
      }
      totalBase64Size += sizeBytes;
    }

    // Validate content type if provided
    if (attachment.contentType && !ALLOWED_CONTENT_TYPES.includes(attachment.contentType)) {
      return { valid: false, error: `Content type "${attachment.contentType}" is not allowed` };
    }
  }

  if (totalBase64Size > MAX_TOTAL_SIZE_BYTES) {
    return { valid: false, error: 'Total attachment size exceeds 25MB limit' };
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  // eslint-disable-next-line no-control-regex
  const unsafeChars = /[<>:"/\\|?*\x00-\x1F]/g;
  return filename
    .replace(unsafeChars, '_')
    .replace(/\.{2,}/g, '.')
    .trim();
}

export function normalizeAttachments(attachments: EmailAttachment[]): NormalizedAttachment[] {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return attachments.map((attachment) => ({
    filename: sanitizeFilename(attachment.filename),
    url: attachment.url,
    content: attachment.content,
    contentType: attachment.contentType || getMimeType(attachment.filename),
  }));
}
