const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
];

const SQL_INJECTION_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
  /((\%27)|(\'))union/gi,
];

export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char] || char);
}

export function stripHtmlTags(str: string): string {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

export function sanitizeHtml(str: string): string {
  if (typeof str !== 'string') return str;

  let sanitized = str;
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized;
}

export function sanitizeForSql(str: string): string {
  if (typeof str !== 'string') return str;

  let sanitized = str;
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '');
    }
  }

  return sanitized.replace(/'/g, "''");
}

export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return email;
  return email.trim().toLowerCase().replace(/[<>]/g, '');
}

export function sanitizePhoneNumber(phone: string): string {
  if (typeof phone !== 'string') return phone;
  return phone.replace(/[^\d+\-\s()]/g, '');
}

export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return url;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: { htmlEscape?: boolean; stripTags?: boolean; sanitizeHtml?: boolean } = {}
): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      let sanitizedValue = value;

      if (options.stripTags) {
        sanitizedValue = stripHtmlTags(sanitizedValue);
      }
      if (options.sanitizeHtml) {
        sanitizedValue = sanitizeHtml(sanitizedValue);
      }
      if (options.htmlEscape) {
        sanitizedValue = escapeHtml(sanitizedValue);
      }

      sanitized[key] = sanitizedValue;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, options);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

export function sanitizeTemplatePayload(payload: Record<string, any>): Record<string, any> {
  return sanitizeObject(payload, { sanitizeHtml: true });
}

export function sanitizeApiInput<T extends Record<string, any>>(input: T): T {
  return sanitizeObject(input, { htmlEscape: true });
}

export function validateAndSanitizeRecipient(
  recipient: string,
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP'
): { valid: boolean; sanitized: string; error?: string } {
  switch (channel) {
    case 'EMAIL': {
      const sanitized = sanitizeEmail(recipient);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(sanitized)) {
        return { valid: false, sanitized, error: 'Invalid email format' };
      }
      return { valid: true, sanitized };
    }
    case 'SMS':
    case 'WHATSAPP': {
      const sanitized = sanitizePhoneNumber(recipient);
      const phoneRegex = /^\+?[\d\s\-()]{8,20}$/;
      if (!phoneRegex.test(sanitized)) {
        return { valid: false, sanitized, error: 'Invalid phone number format' };
      }
      return { valid: true, sanitized };
    }
    default:
      return { valid: true, sanitized: recipient };
  }
}
