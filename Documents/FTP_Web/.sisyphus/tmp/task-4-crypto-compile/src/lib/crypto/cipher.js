"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoDecryptFailedError = exports.CryptoVersionMismatchError = exports.CryptoCiphertextCorruptedError = exports.CryptoKeyMissingError = exports.CryptoError = exports.CryptoErrorCode = void 0;
exports.deriveKey = deriveKey;
exports.loadDerivedKey = loadDerivedKey;
exports.encryptWithKey = encryptWithKey;
exports.decryptWithKey = decryptWithKey;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const node_crypto_1 = require("node:crypto");
const constants_1 = require("../constants");
const ALGORITHM = "aes-256-gcm";
const CIPHER_VERSION = "v1";
const KEY_DERIVATION_SALT = "ftp-webui:credential-encryption:v1";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const ENCRYPTED_PARTS_COUNT = 4;
const BASE64_SEGMENT_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
exports.CryptoErrorCode = {
    KEY_MISSING: "CRYPTO_KEY_MISSING",
    CIPHERTEXT_CORRUPTED: "CRYPTO_CIPHERTEXT_CORRUPTED",
    VERSION_MISMATCH: "CRYPTO_VERSION_MISMATCH",
    DECRYPT_FAILED: constants_1.ErrorCode.CRYPTO_DECRYPT_FAILED,
};
class CryptoError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "CryptoError";
    }
}
exports.CryptoError = CryptoError;
class CryptoKeyMissingError extends CryptoError {
    constructor() {
        super("APP_MASTER_KEY is missing.", exports.CryptoErrorCode.KEY_MISSING);
        this.name = "CryptoKeyMissingError";
    }
}
exports.CryptoKeyMissingError = CryptoKeyMissingError;
class CryptoCiphertextCorruptedError extends CryptoError {
    constructor(message = "Encrypted payload is corrupted.") {
        super(message, exports.CryptoErrorCode.CIPHERTEXT_CORRUPTED);
        this.name = "CryptoCiphertextCorruptedError";
    }
}
exports.CryptoCiphertextCorruptedError = CryptoCiphertextCorruptedError;
class CryptoVersionMismatchError extends CryptoError {
    constructor(version) {
        super(`Unsupported encrypted payload version: ${version}.`, exports.CryptoErrorCode.VERSION_MISMATCH);
        this.name = "CryptoVersionMismatchError";
    }
}
exports.CryptoVersionMismatchError = CryptoVersionMismatchError;
class CryptoDecryptFailedError extends CryptoError {
    constructor(cause) {
        super("Failed to decrypt credential.", exports.CryptoErrorCode.DECRYPT_FAILED);
        this.name = "CryptoDecryptFailedError";
        if (cause !== undefined) {
            this.cause = cause;
        }
    }
}
exports.CryptoDecryptFailedError = CryptoDecryptFailedError;
function loadMasterKey() {
    const masterKey = process.env.APP_MASTER_KEY;
    if (!masterKey) {
        throw new CryptoKeyMissingError();
    }
    return masterKey;
}
function deriveKey(masterKey) {
    if (!masterKey) {
        throw new CryptoKeyMissingError();
    }
    return (0, node_crypto_1.scryptSync)(masterKey, KEY_DERIVATION_SALT, KEY_LENGTH_BYTES);
}
function loadDerivedKey() {
    return deriveKey(loadMasterKey());
}
function decodeBase64Segment(value, segmentName) {
    if (!value || !BASE64_SEGMENT_PATTERN.test(value)) {
        throw new CryptoCiphertextCorruptedError(`${segmentName} is not valid base64 content.`);
    }
    const decoded = Buffer.from(value, "base64");
    const canonicalEncoded = decoded.toString("base64").replace(/=+$/u, "");
    const normalizedInput = value.replace(/=+$/u, "");
    if (decoded.length === 0 || canonicalEncoded !== normalizedInput) {
        throw new CryptoCiphertextCorruptedError(`${segmentName} is not valid canonical base64.`);
    }
    return decoded;
}
function parseEncryptedPayload(encoded) {
    const parts = encoded.split(":");
    if (parts.length !== ENCRYPTED_PARTS_COUNT) {
        throw new CryptoCiphertextCorruptedError("Encrypted payload format must be version:iv:authTag:ciphertext.");
    }
    const [version, ivBase64, authTagBase64, ciphertextBase64] = parts;
    if (version !== CIPHER_VERSION) {
        throw new CryptoVersionMismatchError(version);
    }
    const iv = decodeBase64Segment(ivBase64, "iv");
    const authTag = decodeBase64Segment(authTagBase64, "authTag");
    const ciphertext = decodeBase64Segment(ciphertextBase64, "ciphertext");
    if (iv.length !== IV_LENGTH_BYTES) {
        throw new CryptoCiphertextCorruptedError(`iv must be ${IV_LENGTH_BYTES} bytes.`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
        throw new CryptoCiphertextCorruptedError(`authTag must be ${AUTH_TAG_LENGTH_BYTES} bytes.`);
    }
    return { iv, authTag, ciphertext };
}
function encryptWithKey(plaintext, key) {
    const iv = (0, node_crypto_1.randomBytes)(IV_LENGTH_BYTES);
    const cipher = (0, node_crypto_1.createCipheriv)(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(plaintext, "utf8")),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
        CIPHER_VERSION,
        iv.toString("base64"),
        authTag.toString("base64"),
        ciphertext.toString("base64"),
    ].join(":");
}
function decryptWithKey(encrypted, key) {
    const { iv, authTag, ciphertext } = parseEncryptedPayload(encrypted);
    try {
        const decipher = (0, node_crypto_1.createDecipheriv)(ALGORITHM, key, iv, {
            authTagLength: AUTH_TAG_LENGTH_BYTES,
        });
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        return plaintext.toString("utf8");
    }
    catch (error) {
        throw new CryptoDecryptFailedError(error);
    }
}
function encrypt(plaintext) {
    return encryptWithKey(plaintext, loadDerivedKey());
}
function decrypt(encrypted) {
    return decryptWithKey(encrypted, loadDerivedKey());
}
