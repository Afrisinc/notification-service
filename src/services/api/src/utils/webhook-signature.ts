import crypto from 'crypto';

/**
 * Webhook signature verification utilities
 *
 * Supports afrisinc-pay's Stripe-style signature format:
 * X-Afrisinc-Signature: t=<timestamp>,v1=<HMAC-SHA256(timestamp.body)>
 */

export interface SignatureVerificationResult {
  valid: boolean;
  timestamp?: number;
  error?: string;
}

/**
 * Parse the afrisinc-pay signature header into its components
 *
 * @param header Raw signature header value
 * @returns Parsed timestamp and signature, or null if invalid format
 */
export function parseSignatureHeader(header: string): { timestamp: string; signature: string } | null {
  if (!header) return null;

  try {
    const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
    const timestamp = parts['t'];
    const signature = parts['v1'];

    if (!timestamp || !signature) return null;

    return { timestamp, signature };
  } catch {
    return null;
  }
}

/**
 * Verify an afrisinc-pay webhook signature
 *
 * @param secret Webhook secret key
 * @param rawBody Raw request body as string
 * @param header Signature header value (X-Afrisinc-Signature)
 * @param toleranceSeconds Maximum age of signature in seconds (default: 300 = 5 minutes)
 * @returns Verification result with validity and any error message
 *
 * @example
 * ```typescript
 * const result = verifyAfrisincSignature(
 *   env.AFRISINC_PAY_WEBHOOK_SECRET,
 *   JSON.stringify(req.body),
 *   req.headers['x-afrisinc-signature']
 * );
 *
 * if (!result.valid) {
 *   return reply.status(401).send({ error: result.error });
 * }
 * ```
 */
export function verifyAfrisincSignature(
  secret: string,
  rawBody: string,
  header: string | undefined,
  toleranceSeconds: number = 300
): SignatureVerificationResult {
  if (!header) {
    return { valid: false, error: 'Missing signature header' };
  }

  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    return { valid: false, error: 'Invalid signature format' };
  }

  const { timestamp, signature } = parsed;

  // Verify timestamp is recent (prevent replay attacks)
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return { valid: false, error: 'Invalid timestamp' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNum) > toleranceSeconds) {
    return { valid: false, error: 'Signature timestamp expired', timestamp: timestampNum };
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    const signaturesMatch = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    if (!signaturesMatch) {
      return { valid: false, error: 'Signature mismatch', timestamp: timestampNum };
    }

    return { valid: true, timestamp: timestampNum };
  } catch {
    return { valid: false, error: 'Signature verification failed' };
  }
}

/**
 * Generate a webhook signature for testing purposes
 *
 * @param secret Webhook secret key
 * @param payload Request body
 * @param timestamp Unix timestamp (defaults to now)
 * @returns Formatted signature header value
 */
export function generateSignature(secret: string, payload: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${ts},v1=${signature}`;
}
