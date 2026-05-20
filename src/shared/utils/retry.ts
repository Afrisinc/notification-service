import pino from 'pino';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const defaultConfig: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
};

const defaultLogger = pino({ level: 'info' });

export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitterFactor: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.floor(cappedDelay + jitter));
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  logger?: pino.Logger
): Promise<T> {
  const finalConfig = { ...defaultConfig, ...config };
  const log = logger || defaultLogger;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (finalConfig.retryableErrors && finalConfig.retryableErrors.length > 0) {
        const isRetryable = finalConfig.retryableErrors.some(
          (errType) => lastError?.message.includes(errType) || lastError?.name === errType
        );
        if (!isRetryable) {
          throw lastError;
        }
      }

      if (attempt > finalConfig.maxRetries) {
        log.error({ attempt, maxRetries: finalConfig.maxRetries, error: lastError.message }, 'Max retries exceeded');
        throw lastError;
      }

      const delayMs = calculateBackoffDelay(
        attempt,
        finalConfig.baseDelayMs,
        finalConfig.maxDelayMs,
        finalConfig.backoffMultiplier,
        finalConfig.jitterFactor
      );

      log.warn(
        { attempt, maxRetries: finalConfig.maxRetries, delayMs, error: lastError.message },
        'Retrying after failure'
      );

      finalConfig.onRetry?.(attempt, lastError, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

export class RetryableOperation<T> {
  private attempts: number = 0;
  private lastError: Error | null = null;

  constructor(
    private fn: () => Promise<T>,
    private config: RetryConfig = defaultConfig,
    private logger: pino.Logger = defaultLogger
  ) {}

  async execute(): Promise<T> {
    return retryWithBackoff(this.fn, this.config, this.logger);
  }

  getAttempts(): number {
    return this.attempts;
  }

  getLastError(): Error | null {
    return this.lastError;
  }
}

export interface QueueRetryConfig {
  maxRetries: number;
  delays: number[];
}

export const queueRetryConfigs = {
  email: {
    maxRetries: 5,
    delays: [1000, 5000, 15000, 60000, 300000],
  },
  sms: {
    maxRetries: 3,
    delays: [2000, 10000, 60000],
  },
  webhook: {
    maxRetries: 5,
    delays: [1000, 5000, 30000, 120000, 600000],
  },
};

export function getQueueRetryDelay(config: QueueRetryConfig, attempt: number): number {
  if (attempt >= config.maxRetries) {
    return -1;
  }
  const index = Math.min(attempt, config.delays.length - 1);
  const baseDelay = config.delays[index];
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(baseDelay + jitter);
}

export function shouldRetryQueueMessage(config: QueueRetryConfig, attempt: number): boolean {
  return attempt < config.maxRetries;
}
