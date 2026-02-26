"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.ERROR_HTTP_STATUS = void 0;
exports.connectionNotFound = connectionNotFound;
exports.authFailed = authFailed;
exports.invalidPath = invalidPath;
exports.cryptoDecryptFailed = cryptoDecryptFailed;
exports.validationError = validationError;
exports.targetNotAllowed = targetNotAllowed;
exports.fileTooLarge = fileTooLarge;
exports.fileVersionConflict = fileVersionConflict;
exports.tlsValidationFailed = tlsValidationFailed;
exports.hostKeyMismatch = hostKeyMismatch;
exports.retryExhausted = retryExhausted;
exports.staleTarget = staleTarget;
const constants_1 = require("./constants");
exports.ERROR_HTTP_STATUS = {
    [constants_1.ErrorCode.CONNECTION_NOT_FOUND]: 404,
    [constants_1.ErrorCode.CONNECTION_TIMEOUT]: 408,
    [constants_1.ErrorCode.AUTH_FAILED]: 401,
    [constants_1.ErrorCode.INVALID_PATH]: 400,
    [constants_1.ErrorCode.VALIDATION_ERROR]: 400,
    [constants_1.ErrorCode.TARGET_NOT_ALLOWED]: 403,
    [constants_1.ErrorCode.CRYPTO_DECRYPT_FAILED]: 500,
    [constants_1.ErrorCode.FILE_TOO_LARGE]: 400,
    [constants_1.ErrorCode.FILE_VERSION_CONFLICT]: 409,
    [constants_1.ErrorCode.TLS_VALIDATION_FAILED]: 403,
    [constants_1.ErrorCode.HOST_KEY_MISMATCH]: 403,
    [constants_1.ErrorCode.RETRY_EXHAUSTED]: 429,
    [constants_1.ErrorCode.STALE_TARGET]: 409,
};
class AppError extends Error {
    code;
    statusCode;
    details;
    constructor(options) {
        super(options.message);
        this.name = "AppError";
        this.code = options.code;
        this.statusCode = options.statusCode ?? exports.ERROR_HTTP_STATUS[options.code] ?? 500;
        this.details = options.details;
    }
    toJSON() {
        const payload = {
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
exports.AppError = AppError;
function createError(code, message, details) {
    return new AppError({
        code,
        message,
        details,
    });
}
function connectionNotFound(id) {
    return createError(constants_1.ErrorCode.CONNECTION_NOT_FOUND, `Connection ${id} not found`, { id });
}
function authFailed(host) {
    return createError(constants_1.ErrorCode.AUTH_FAILED, `Authentication failed for host ${host}`, { host });
}
function invalidPath(path) {
    return createError(constants_1.ErrorCode.INVALID_PATH, `Invalid path: ${path}`, { path });
}
function cryptoDecryptFailed() {
    return createError(constants_1.ErrorCode.CRYPTO_DECRYPT_FAILED, "Failed to decrypt protected secret");
}
function validationError(details) {
    return createError(constants_1.ErrorCode.VALIDATION_ERROR, "Input validation failed", details);
}
function targetNotAllowed(host) {
    return createError(constants_1.ErrorCode.TARGET_NOT_ALLOWED, `Target host is not allowed: ${host}`, {
        host,
    });
}
function fileTooLarge(size, limit) {
    return createError(constants_1.ErrorCode.FILE_TOO_LARGE, `File size ${size} exceeds limit ${limit}`, {
        size,
        limit,
    });
}
function fileVersionConflict(path) {
    return createError(constants_1.ErrorCode.FILE_VERSION_CONFLICT, `File version conflict at ${path}`, {
        path,
    });
}
function tlsValidationFailed(host) {
    return createError(constants_1.ErrorCode.TLS_VALIDATION_FAILED, `TLS validation failed for host ${host}`, {
        host,
    });
}
function hostKeyMismatch(host) {
    return createError(constants_1.ErrorCode.HOST_KEY_MISMATCH, `Host key mismatch for host ${host}`, {
        host,
    });
}
function retryExhausted(attempts) {
    return createError(constants_1.ErrorCode.RETRY_EXHAUSTED, `Retry exhausted after ${attempts} attempts`, {
        attempts,
    });
}
function staleTarget(path) {
    return createError(constants_1.ErrorCode.STALE_TARGET, `Target changed before operation: ${path}`, {
        path,
    });
}
