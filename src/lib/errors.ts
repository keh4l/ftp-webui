import { ErrorCode } from "./constants";
import type { ErrorCode as ErrorCodeType } from "./constants";

export const ERROR_HTTP_STATUS: Record<ErrorCodeType, number> = {
  [ErrorCode.CONNECTION_NOT_FOUND]: 404,
  [ErrorCode.CONNECTION_TIMEOUT]: 408,
  [ErrorCode.AUTH_FAILED]: 401,
  [ErrorCode.INVALID_PATH]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.TARGET_NOT_ALLOWED]: 403,
  [ErrorCode.CRYPTO_DECRYPT_FAILED]: 500,
  [ErrorCode.FILE_TOO_LARGE]: 400,
  [ErrorCode.FILE_VERSION_CONFLICT]: 409,
  [ErrorCode.TLS_VALIDATION_FAILED]: 403,
  [ErrorCode.HOST_KEY_MISMATCH]: 403,
  [ErrorCode.RETRY_EXHAUSTED]: 429,
  [ErrorCode.STALE_TARGET]: 409,
};

type AppErrorOptions = {
  code: ErrorCodeType;
  message: string;
  statusCode?: number;
  details?: unknown;
};

export class AppError extends Error {
  readonly code: ErrorCodeType;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode ?? ERROR_HTTP_STATUS[options.code] ?? 500;
    this.details = options.details;
  }

  toJSON() {
    const payload: {
      error: {
        code: ErrorCodeType;
        message: string;
        details?: unknown;
      };
    } = {
      error: {
        code: this.code,
        message: this.message,
      },
    };

    if (this.details !== undefined) {
      payload.error.details = this.details;
    }

    return payload;
  }
}

function createError(code: ErrorCodeType, message: string, details?: unknown): AppError {
  return new AppError({
    code,
    message,
    details,
  });
}

export function connectionNotFound(id: string): AppError {
  return createError(ErrorCode.CONNECTION_NOT_FOUND, `Connection ${id} not found`, { id });
}

export function authFailed(host: string): AppError {
  return createError(ErrorCode.AUTH_FAILED, `Authentication failed for host ${host}`, { host });
}

export function invalidPath(path: string): AppError {
  return createError(ErrorCode.INVALID_PATH, `Invalid path: ${path}`, { path });
}

export function cryptoDecryptFailed(): AppError {
  return createError(ErrorCode.CRYPTO_DECRYPT_FAILED, "Failed to decrypt protected secret");
}

export function validationError(details: unknown): AppError {
  return createError(ErrorCode.VALIDATION_ERROR, "Input validation failed", details);
}

export function targetNotAllowed(host: string): AppError {
  return createError(ErrorCode.TARGET_NOT_ALLOWED, `Target host is not allowed: ${host}`, {
    host,
  });
}

export function fileTooLarge(size: number, limit: number): AppError {
  return createError(
    ErrorCode.FILE_TOO_LARGE,
    `File size ${size} exceeds limit ${limit}`,
    {
      size,
      limit,
    }
  );
}

export function fileVersionConflict(path: string): AppError {
  return createError(ErrorCode.FILE_VERSION_CONFLICT, `File version conflict at ${path}`, {
    path,
  });
}

export function tlsValidationFailed(host: string): AppError {
  return createError(ErrorCode.TLS_VALIDATION_FAILED, `TLS validation failed for host ${host}`, {
    host,
  });
}

export function hostKeyMismatch(host: string): AppError {
  return createError(ErrorCode.HOST_KEY_MISMATCH, `Host key mismatch for host ${host}`, {
    host,
  });
}

export function retryExhausted(attempts: number): AppError {
  return createError(ErrorCode.RETRY_EXHAUSTED, `Retry exhausted after ${attempts} attempts`, {
    attempts,
  });
}

export function staleTarget(path: string): AppError {
  return createError(ErrorCode.STALE_TARGET, `Target changed before operation: ${path}`, {
    path,
  });
}
