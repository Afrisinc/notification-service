import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { logger } from '../config/logger';
import { CircuitBreaker, CircuitState, getCircuitBreaker } from '../../../../shared/utils/circuit-breaker';

/**
 * Payment intent request payload
 */
export interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
  orderId: string;
  customerEmail: string;
  metadata?: Record<string, string>;
}

/**
 * Payment intent response
 */
export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  orderId: string;
  customerEmail: string;
  createdAt: string;
  expiresAt?: string;
}

/**
 * Payment intent status
 */
export type PaymentIntentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'requires_action';

/**
 * Payment confirmation request
 */
export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
}

/**
 * Refund request payload
 */
export interface RefundRequest {
  paymentIntentId: string;
  amount?: number;
  reason?: RefundReason;
}

/**
 * Refund reason types
 */
export type RefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'other';

/**
 * Refund response
 */
export interface Refund {
  id: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason?: RefundReason;
  createdAt: string;
}

/**
 * Refund status
 */
export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

/**
 * Customer payment method
 */
export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  billingDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
}

/**
 * Payment transaction record
 */
export interface PaymentTransaction {
  id: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  status: string;
  type: 'payment' | 'refund';
  createdAt: string;
}

/**
 * Payment service error response
 */
export interface PaymentErrorResponse {
  error: {
    code: string;
    message: string;
    param?: string;
  };
}

/**
 * Payment client error with additional context
 */
export class PaymentClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly param?: string
  ) {
    super(message);
    this.name = 'PaymentClientError';
  }
}

/**
 * Payment Client Configuration
 */
export interface PaymentClientConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
  enableCircuitBreaker?: boolean;
}

/**
 * PaymentClient - Professional HTTP client for Payment Service integration
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Circuit breaker pattern for fault tolerance
 * - Comprehensive error handling
 * - Request/response logging
 * - TypeScript type safety
 *
 * @example
 * ```typescript
 * // Initialize during app bootstrap
 * initPaymentClient({
 *   baseURL: process.env.PAYMENT_SERVICE_URL,
 *   apiKey: process.env.PAYMENT_API_KEY
 * });
 *
 * // Use in services
 * const client = getPaymentClient();
 * const intent = await client.createPaymentIntent({
 *   amount: 1000,
 *   currency: 'USD',
 *   orderId: 'order-123',
 *   customerEmail: 'customer@example.com'
 * });
 * ```
 */
export class PaymentClient {
  private client: AxiosInstance;
  private circuitBreaker: CircuitBreaker | null = null;
  private readonly DEFAULT_TIMEOUT = 30000;
  private readonly MAX_RETRIES: number;
  private readonly RETRY_DELAYS = [100, 200, 400, 800];

  constructor(private readonly config: PaymentClientConfig) {
    if (!config.baseURL?.trim()) {
      throw new Error('PaymentClient: baseURL is required');
    }
    if (!config.apiKey?.trim()) {
      throw new Error('PaymentClient: apiKey is required');
    }

    this.MAX_RETRIES = config.maxRetries ?? 3;

    this.client = axios.create({
      baseURL: config.baseURL.replace(/\/$/, ''),
      timeout: config.timeout ?? this.DEFAULT_TIMEOUT,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (config.enableCircuitBreaker !== false) {
      this.circuitBreaker = getCircuitBreaker('payment-service', {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: config.timeout ?? this.DEFAULT_TIMEOUT,
        resetTimeout: 60000,
        onOpen: (failures) => {
          logger.error({ failures }, '[PaymentClient] Circuit breaker opened');
        },
        onRecover: () => {
          logger.info('[PaymentClient] Circuit breaker recovered');
        },
      });
    }

    logger.info(`[PaymentClient] Initialized with base URL: ${config.baseURL}`);
  }

  /**
   * Create a payment intent for a new transaction
   *
   * @param request Payment intent details
   * @returns Created payment intent with client secret
   * @throws PaymentClientError on failure
   *
   * @example
   * ```typescript
   * const intent = await paymentClient.createPaymentIntent({
   *   amount: 5000, // $50.00 in cents
   *   currency: 'USD',
   *   orderId: 'order-abc-123',
   *   customerEmail: 'user@example.com',
   *   metadata: { productId: 'prod-456' }
   * });
   * ```
   */
  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    this.validatePaymentIntentRequest(request);

    logger.debug({ orderId: request.orderId, amount: request.amount }, '[PaymentClient] Creating payment intent');

    return this.executeWithResilience<PaymentIntent>(
      () =>
        this.client.post<PaymentIntent>('/payments/intent', {
          amount: request.amount,
          currency: request.currency,
          orderId: request.orderId,
          customerEmail: request.customerEmail,
          metadata: request.metadata,
        }),
      'create payment intent'
    );
  }

  /**
   * Retrieve a payment intent by ID
   *
   * @param paymentIntentId Payment intent ID
   * @returns Payment intent details
   * @throws PaymentClientError if not found or request fails
   */
  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    if (!paymentIntentId?.trim()) {
      throw new PaymentClientError('paymentIntentId is required', 'INVALID_PARAM', 400, 'paymentIntentId');
    }

    logger.debug({ paymentIntentId }, '[PaymentClient] Fetching payment intent');

    return this.executeWithResilience<PaymentIntent>(
      () => this.client.get<PaymentIntent>(`/payments/intent/${paymentIntentId}`),
      `get payment intent: ${paymentIntentId}`
    );
  }

  /**
   * Confirm a payment intent
   *
   * @param request Confirmation details
   * @returns Updated payment intent
   * @throws PaymentClientError on failure
   */
  async confirmPayment(request: ConfirmPaymentRequest): Promise<PaymentIntent> {
    if (!request.paymentIntentId?.trim()) {
      throw new PaymentClientError('paymentIntentId is required', 'INVALID_PARAM', 400, 'paymentIntentId');
    }

    logger.debug({ paymentIntentId: request.paymentIntentId }, '[PaymentClient] Confirming payment');

    return this.executeWithResilience<PaymentIntent>(
      () => this.client.post<PaymentIntent>(`/payments/intent/${request.paymentIntentId}/confirm`, request),
      `confirm payment: ${request.paymentIntentId}`
    );
  }

  /**
   * Cancel a payment intent
   *
   * @param paymentIntentId Payment intent ID to cancel
   * @returns Canceled payment intent
   * @throws PaymentClientError on failure
   */
  async cancelPayment(paymentIntentId: string): Promise<PaymentIntent> {
    if (!paymentIntentId?.trim()) {
      throw new PaymentClientError('paymentIntentId is required', 'INVALID_PARAM', 400, 'paymentIntentId');
    }

    logger.debug({ paymentIntentId }, '[PaymentClient] Canceling payment');

    return this.executeWithResilience<PaymentIntent>(
      () => this.client.post<PaymentIntent>(`/payments/intent/${paymentIntentId}/cancel`),
      `cancel payment: ${paymentIntentId}`
    );
  }

  /**
   * Create a refund for a payment
   *
   * @param request Refund details
   * @returns Created refund
   * @throws PaymentClientError on failure
   *
   * @example
   * ```typescript
   * // Full refund
   * const refund = await paymentClient.createRefund({
   *   paymentIntentId: 'pi_123',
   *   reason: 'requested_by_customer'
   * });
   *
   * // Partial refund
   * const partialRefund = await paymentClient.createRefund({
   *   paymentIntentId: 'pi_123',
   *   amount: 1000, // $10.00
   *   reason: 'other'
   * });
   * ```
   */
  async createRefund(request: RefundRequest): Promise<Refund> {
    if (!request.paymentIntentId?.trim()) {
      throw new PaymentClientError('paymentIntentId is required', 'INVALID_PARAM', 400, 'paymentIntentId');
    }

    if (request.amount !== undefined && request.amount <= 0) {
      throw new PaymentClientError('amount must be positive', 'INVALID_PARAM', 400, 'amount');
    }

    logger.debug(
      { paymentIntentId: request.paymentIntentId, amount: request.amount },
      '[PaymentClient] Creating refund'
    );

    return this.executeWithResilience<Refund>(
      () => this.client.post<Refund>('/payments/refunds', request),
      `create refund for: ${request.paymentIntentId}`
    );
  }

  /**
   * Get refund by ID
   *
   * @param refundId Refund ID
   * @returns Refund details
   * @throws PaymentClientError if not found
   */
  async getRefund(refundId: string): Promise<Refund> {
    if (!refundId?.trim()) {
      throw new PaymentClientError('refundId is required', 'INVALID_PARAM', 400, 'refundId');
    }

    logger.debug({ refundId }, '[PaymentClient] Fetching refund');

    return this.executeWithResilience<Refund>(
      () => this.client.get<Refund>(`/payments/refunds/${refundId}`),
      `get refund: ${refundId}`
    );
  }

  /**
   * List transactions for an order
   *
   * @param orderId Order ID
   * @param options Pagination options
   * @returns List of transactions
   */
  async listTransactions(
    orderId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ transactions: PaymentTransaction[]; total: number }> {
    if (!orderId?.trim()) {
      throw new PaymentClientError('orderId is required', 'INVALID_PARAM', 400, 'orderId');
    }

    const params = new URLSearchParams();
    params.append('orderId', orderId);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    logger.debug({ orderId }, '[PaymentClient] Listing transactions');

    return this.executeWithResilience<{ transactions: PaymentTransaction[]; total: number }>(
      () => this.client.get(`/payments/transactions?${params.toString()}`),
      `list transactions for order: ${orderId}`
    );
  }

  /**
   * Retrieve customer payment methods
   *
   * @param customerEmail Customer email
   * @returns List of saved payment methods
   */
  async getCustomerPaymentMethods(customerEmail: string): Promise<PaymentMethod[]> {
    if (!customerEmail?.trim()) {
      throw new PaymentClientError('customerEmail is required', 'INVALID_PARAM', 400, 'customerEmail');
    }

    logger.debug({ customerEmail }, '[PaymentClient] Fetching customer payment methods');

    const result = await this.executeWithResilience<{ paymentMethods: PaymentMethod[] }>(
      () => this.client.get(`/payments/customers/${encodeURIComponent(customerEmail)}/payment-methods`),
      `get payment methods for: ${customerEmail}`
    );

    return result.paymentMethods || [];
  }

  /**
   * Health check - verify connection to Payment service
   *
   * @returns true if service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      logger.debug('[PaymentClient] Health check passed');
      return response.status === 200;
    } catch (error) {
      logger.warn('[PaymentClient] Health check failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Get circuit breaker state
   *
   * @returns Current circuit breaker state or null if disabled
   */
  getCircuitState(): CircuitState | null {
    return this.circuitBreaker?.getState() ?? null;
  }

  /**
   * Execute request with circuit breaker and retry logic
   */
  private async executeWithResilience<T>(
    request: () => Promise<{ data: T }>,
    operationName: string
  ): Promise<T> {
    const execute = async (): Promise<T> => {
      return this.executeWithRetry(request, operationName);
    };

    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(execute);
    }

    return execute();
  }

  /**
   * Execute request with automatic retry logic
   */
  private async executeWithRetry<T>(
    request: () => Promise<{ data: T }>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await request();
        return response.data;
      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError<PaymentErrorResponse>;
        const statusCode = axiosError?.response?.status;

        // Don't retry on client errors (4xx) except 429 (rate limit) and 408 (timeout)
        if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429 && statusCode !== 408) {
          this.handleError(error, operationName);
        }

        logger.warn(
          { attempt, maxRetries: this.MAX_RETRIES, error: lastError.message },
          `[PaymentClient] Attempt ${attempt}/${this.MAX_RETRIES} failed for ${operationName}`
        );

        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAYS[Math.min(attempt - 1, this.RETRY_DELAYS.length - 1)];
          await this.sleep(delay);
        }
      }
    }

    this.handleError(lastError, operationName);
  }

  /**
   * Handle and format errors with proper logging
   */
  private handleError(error: unknown, operationName: string): never {
    const axiosError = error as AxiosError<PaymentErrorResponse>;

    if (axiosError?.response?.data?.error) {
      const { code, message, param } = axiosError.response.data.error;
      logger.error({ code, param }, `[PaymentClient] Failed to ${operationName}: ${message}`);
      throw new PaymentClientError(message, code, axiosError.response.status, param);
    }

    if (axiosError?.response?.status) {
      const message = `HTTP ${axiosError.response.status}: ${axiosError.message}`;
      logger.error(`[PaymentClient] Failed to ${operationName}: ${message}`);
      throw new PaymentClientError(message, 'HTTP_ERROR', axiosError.response.status);
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[PaymentClient] Failed to ${operationName}: ${message}`);
    throw new PaymentClientError(message, 'UNKNOWN_ERROR');
  }

  /**
   * Validate payment intent request
   */
  private validatePaymentIntentRequest(request: CreatePaymentIntentRequest): void {
    if (!request.amount || request.amount <= 0) {
      throw new PaymentClientError('amount must be a positive number', 'INVALID_PARAM', 400, 'amount');
    }

    if (!request.currency?.trim()) {
      throw new PaymentClientError('currency is required', 'INVALID_PARAM', 400, 'currency');
    }

    if (request.currency.length !== 3) {
      throw new PaymentClientError('currency must be a 3-letter ISO code', 'INVALID_PARAM', 400, 'currency');
    }

    if (!request.orderId?.trim()) {
      throw new PaymentClientError('orderId is required', 'INVALID_PARAM', 400, 'orderId');
    }

    if (!request.customerEmail?.trim()) {
      throw new PaymentClientError('customerEmail is required', 'INVALID_PARAM', 400, 'customerEmail');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.customerEmail)) {
      throw new PaymentClientError('customerEmail must be a valid email', 'INVALID_PARAM', 400, 'customerEmail');
    }
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance
 */
let singletonInstance: PaymentClient | null = null;

/**
 * Initialize the PaymentClient singleton
 *
 * Call this once during application startup
 *
 * @param config Client configuration
 * @returns Initialized PaymentClient instance
 *
 * @example
 * ```typescript
 * // In your app bootstrap
 * import { initPaymentClient } from './utils/payment-client';
 * import { env } from './config/env';
 *
 * initPaymentClient({
 *   baseURL: env.PAYMENT_SERVICE_URL,
 *   apiKey: env.PAYMENT_API_KEY
 * });
 * ```
 */
export function initPaymentClient(config: PaymentClientConfig): PaymentClient {
  singletonInstance = new PaymentClient(config);
  logger.info('[PaymentClient] Singleton instance initialized');
  return singletonInstance;
}

/**
 * Get the PaymentClient singleton instance
 *
 * Must call initPaymentClient() first during application bootstrap
 *
 * @returns The PaymentClient singleton instance
 * @throws Error if not initialized
 *
 * @example
 * ```typescript
 * import { getPaymentClient } from './utils/payment-client';
 *
 * async function processOrder(order: Order) {
 *   const paymentClient = getPaymentClient();
 *   const intent = await paymentClient.createPaymentIntent({
 *     amount: order.totalCents,
 *     currency: 'USD',
 *     orderId: order.id,
 *     customerEmail: order.customerEmail
 *   });
 *   return intent;
 * }
 * ```
 */
export function getPaymentClient(): PaymentClient {
  if (!singletonInstance) {
    throw new Error(
      'PaymentClient not initialized. Call initPaymentClient(config) during application bootstrap.'
    );
  }
  return singletonInstance;
}

/**
 * Check if PaymentClient is initialized
 *
 * @returns true if the singleton is initialized
 */
export function isPaymentClientInitialized(): boolean {
  return singletonInstance !== null;
}

export default PaymentClient;
