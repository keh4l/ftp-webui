import { ErrorCode } from "@/lib/constants";
import { AppError, retryExhausted } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type RetryFn<T> = () => Promise<T>;

export type RetryEvent = {
  attempt: number;
  nextAttempt: number;
  delayMs: number;
  error: unknown;
};

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (event: RetryEvent) => void;
  signal?: AbortSignal;
  operationName?: string;
  metrics?: ResilienceMetrics;
  circuitBreaker?: CircuitBreaker;
};

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  halfOpenMaxCalls?: number;
};

export type CircuitState = "closed" | "open" | "half-open";

export type CircuitSnapshot = {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
  halfOpenInFlight: number;
};

export type ResilienceMetricsSnapshot = {
  attempts: number;
  retries: number;
  successes: number;
  failures: number;
  exhausted: number;
  timeouts: number;
  circuitOpenRejects: number;
};

export type TimeoutOperation<T> = (signal: AbortSignal) => Promise<T>;

const DEFAULT_RETRY_OPTIONS = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
} as const;

const DEFAULT_CIRCUIT_OPTIONS = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxCalls: 1,
} as const;

const RETRYABLE_NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"]);

const NON_RETRYABLE_CODES = new Set<string>([
  ErrorCode.AUTH_FAILED,
  ErrorCode.INVALID_PATH,
  ErrorCode.FILE_TOO_LARGE,
  ErrorCode.VALIDATION_ERROR,
  ErrorCode.HOST_KEY_MISMATCH,
  ErrorCode.TLS_VALIDATION_FAILED,
]);

export class ResilienceMetrics {
  private values: ResilienceMetricsSnapshot = {
    attempts: 0,
    retries: 0,
    successes: 0,
    failures: 0,
    exhausted: 0,
    timeouts: 0,
    circuitOpenRejects: 0,
  };

  incrementAttempt(): void {
    this.values.attempts += 1;
  }

  incrementRetry(): void {
    this.values.retries += 1;
  }

  incrementSuccess(): void {
    this.values.successes += 1;
  }

  incrementFailure(): void {
    this.values.failures += 1;
  }

  incrementExhausted(): void {
    this.values.exhausted += 1;
  }

  incrementTimeout(): void {
    this.values.timeouts += 1;
  }

  incrementCircuitOpenReject(): void {
    this.values.circuitOpenRejects += 1;
  }

  snapshot(): ResilienceMetricsSnapshot {
    return { ...this.values };
  }
}

export class CircuitBreaker {
  private readonly options: Required<CircuitBreakerOptions>;

  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private halfOpenInFlight = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? DEFAULT_CIRCUIT_OPTIONS.failureThreshold,
      resetTimeoutMs: options.resetTimeoutMs ?? DEFAULT_CIRCUIT_OPTIONS.resetTimeoutMs,
      halfOpenMaxCalls: options.halfOpenMaxCalls ?? DEFAULT_CIRCUIT_OPTIONS.halfOpenMaxCalls,
    };
  }

  getState(): CircuitState {
    this.refreshState();
    return this.state;
  }

  getSnapshot(): CircuitSnapshot {
    this.refreshState();
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      openedAt: this.openedAt,
      halfOpenInFlight: this.halfOpenInFlight,
    };
  }

  async execute<T>(operation: RetryFn<T>, metrics?: ResilienceMetrics): Promise<T> {
    this.refreshState();

    if (this.state === "open") {
      metrics?.incrementCircuitOpenReject();
      throw new AppError({
        code: ErrorCode.RETRY_EXHAUSTED,
        message: "Circuit breaker is open",
        details: {
          retryAfterMs: this.getRetryAfterMs(),
        },
      });
    }

    if (this.state === "half-open" && this.halfOpenInFlight >= this.options.halfOpenMaxCalls) {
      metrics?.incrementCircuitOpenReject();
      throw new AppError({
        code: ErrorCode.RETRY_EXHAUSTED,
        message: "Circuit breaker half-open probe limit reached",
      });
    }

    if (this.state === "half-open") {
      this.halfOpenInFlight += 1;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      if (this.state === "half-open" && this.halfOpenInFlight > 0) {
        this.halfOpenInFlight -= 1;
      }
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.state = "closed";
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;

    if (this.state === "half-open" || this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  private refreshState(): void {
    if (this.state !== "open" || this.openedAt === null) {
      return;
    }

    if (Date.now() - this.openedAt >= this.options.resetTimeoutMs) {
      this.state = "half-open";
      this.halfOpenInFlight = 0;
    }
  }

  private getRetryAfterMs(): number {
    if (this.openedAt === null) {
      return this.options.resetTimeoutMs;
    }

    return Math.max(0, this.options.resetTimeoutMs - (Date.now() - this.openedAt));
  }
}

export async function withTimeout<T>(fn: TimeoutOperation<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    const controller = new AbortController();
    return fn(controller.signal);
  }

  const controller = new AbortController();

  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const timeoutPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => {
        reject(
          new AppError({
            code: ErrorCode.CONNECTION_TIMEOUT,
            message: `Operation timed out after ${timeoutMs}ms`,
            details: {
              timeoutMs,
            },
          }),
        );
      },
      { once: true },
    );
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function withRetry<T>(fn: RetryFn<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts);
  const baseDelayMs = Math.max(1, options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs);
  const backoffMultiplier = Math.max(1, options.backoffMultiplier ?? DEFAULT_RETRY_OPTIONS.backoffMultiplier);
  const shouldRetry = options.shouldRetry ?? isRetryable;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new AppError({
        code: ErrorCode.CONNECTION_TIMEOUT,
        message: "Retry operation aborted",
      });
    }

    options.metrics?.incrementAttempt();

    try {
      const result = options.circuitBreaker
        ? await options.circuitBreaker.execute(fn, options.metrics)
        : await fn();

      options.metrics?.incrementSuccess();
      return result;
    } catch (error) {
      if (isTimeoutError(error)) {
        options.metrics?.incrementTimeout();
      }

      const retryable = shouldRetry(error);
      const hasMoreAttempts = attempt < maxAttempts;

      if (!retryable) {
        options.metrics?.incrementFailure();
        throw error;
      }

      if (!hasMoreAttempts) {
        options.metrics?.incrementFailure();
        options.metrics?.incrementExhausted();
        logger.error(
          {
            operationName: options.operationName,
            attempt,
            maxAttempts,
            error: toLogError(error),
          },
          "Retry attempts exhausted",
        );
        throw retryExhausted(maxAttempts);
      }

      const delayMs = getBackoffDelay({
        retryIndex: attempt - 1,
        baseDelayMs,
        maxDelayMs,
        backoffMultiplier,
      });

      options.metrics?.incrementRetry();
      logger.warn(
        {
          operationName: options.operationName,
          attempt,
          nextAttempt: attempt + 1,
          delayMs,
          error: toLogError(error),
        },
        "Protocol operation failed; retrying with exponential backoff",
      );

      options.onRetry?.({
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        error,
      });

      await sleep(delayMs, options.signal);
    }
  }

  throw retryExhausted(maxAttempts);
}

export function isRetryable(error: unknown): boolean {
  const code = getErrorCode(error);

  if (code === ErrorCode.RETRY_EXHAUSTED) {
    return false;
  }

  if (code === ErrorCode.CONNECTION_TIMEOUT) {
    return true;
  }

  if (code !== undefined && NON_RETRYABLE_CODES.has(code)) {
    return false;
  }

  const networkCode = getNodeErrorCode(error);
  if (networkCode !== undefined && RETRYABLE_NETWORK_CODES.has(networkCode)) {
    return true;
  }

  return false;
}

export function getBackoffDelay(input: {
  retryIndex: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}): number {
  const exponent = Math.max(0, input.retryIndex);
  const rawDelay = Math.min(
    input.baseDelayMs * input.backoffMultiplier ** exponent,
    input.maxDelayMs,
  );

  const jitterFactor = 1 + (Math.random() * 0.4 - 0.2);
  return Math.max(0, Math.round(rawDelay * jitterFactor));
}

async function sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timeoutHandle);
      reject(
        new AppError({
          code: ErrorCode.CONNECTION_TIMEOUT,
          message: "Retry sleep aborted",
        }),
      );
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : undefined;
}

function getNodeErrorCode(error: unknown): string | undefined {
  const code = getErrorCode(error);
  if (code === undefined) {
    return undefined;
  }

  return code.toUpperCase();
}

function isTimeoutError(error: unknown): boolean {
  return getErrorCode(error) === ErrorCode.CONNECTION_TIMEOUT;
}

function toLogError(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: getErrorCode(error),
    };
  }

  return {
    message: String(error),
  };
}
