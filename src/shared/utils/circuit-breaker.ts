import pino from 'pino';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
  onOpen?: (failures: number) => void;
  onRecover?: () => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

const defaultLogger = pino({ level: 'info' });

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttempt: number = 0;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private logger: pino.Logger;

  constructor(
    private config: CircuitBreakerConfig,
    logger?: pino.Logger
  ) {
    this.logger = logger || defaultLogger;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        const error = new Error(`Circuit breaker "${this.config.name}" is OPEN`);
        this.logger.warn({ circuit: this.config.name, state: this.state }, 'Circuit breaker rejected request');
        throw error;
      }
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Circuit breaker "${this.config.name}" timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;
    this.config.onSuccess?.();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else {
      this.failures = 0;
    }

    this.logger.debug({ circuit: this.config.name, state: this.state }, 'Circuit breaker success');
  }

  private onFailure(error: Error): void {
    this.lastFailureTime = Date.now();
    this.totalFailures++;
    this.failures++;
    this.config.onFailure?.(error);

    this.logger.warn({ circuit: this.config.name, state: this.state, error: error.message }, 'Circuit breaker failure');

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failures >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    this.logger.info({ circuit: this.config.name, from: oldState, to: newState }, 'Circuit breaker state change');

    if (newState === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.config.resetTimeout;
      this.successes = 0;
      this.config.onOpen?.(this.failures);
    } else if (newState === CircuitState.CLOSED) {
      if (oldState === CircuitState.HALF_OPEN) {
        this.config.onRecover?.();
      }
      this.failures = 0;
      this.successes = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successes = 0;
    }

    this.config.onStateChange?.(oldState, newState);
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.logger.info({ circuit: this.config.name }, 'Circuit breaker manually reset');
  }

  isAvailable(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttempt) return true;
    return this.state === CircuitState.HALF_OPEN;
  }
}

// Circuit breaker registry for managing multiple breakers
const circuitBreakers: Map<string, CircuitBreaker> = new Map();

export function getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    const breaker = new CircuitBreaker({
      name,
      failureThreshold: config?.failureThreshold ?? 5,
      successThreshold: config?.successThreshold ?? 2,
      timeout: config?.timeout ?? 10000,
      resetTimeout: config?.resetTimeout ?? 30000,
      ...config,
    });
    circuitBreakers.set(name, breaker);
  }
  return circuitBreakers.get(name)!;
}

export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  circuitBreakers.forEach((breaker, name) => {
    stats[name] = breaker.getStats();
  });
  return stats;
}

export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach((breaker) => breaker.reset());
}

// Pre-configured circuit breakers for common providers
export const circuitBreakers_config = {
  sendgrid: {
    name: 'sendgrid',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 15000,
    resetTimeout: 60000,
  },
  smtp: {
    name: 'smtp',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 45000,
  },
  twilio: {
    name: 'twilio',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 10000,
    resetTimeout: 60000,
  },
  africasTalking: {
    name: 'africas-talking',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 15000,
    resetTimeout: 60000,
  },
};
