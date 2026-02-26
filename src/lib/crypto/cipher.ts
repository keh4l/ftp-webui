import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import { ErrorCode } from "../constants";

const ALGORITHM = "aes-256-gcm";
const CIPHER_VERSION = "v1";
const KEY_DERIVATION_SALT = "ftp-webui:credential-encryption:v1";
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const ENCRYPTED_PARTS_COUNT = 4;
const BASE64_SEGMENT_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export const CryptoErrorCode = {
  KEY_MISSING: "CRYPTO_KEY_MISSING",
  CIPHERTEXT_CORRUPTED: "CRYPTO_CIPHERTEXT_CORRUPTED",
  VERSION_MISMATCH: "CRYPTO_VERSION_MISMATCH",
  DECRYPT_FAILED: ErrorCode.CRYPTO_DECRYPT_FAILED,
} as const;

export type CryptoErrorCode =
  (typeof CryptoErrorCode)[keyof typeof CryptoErrorCode];

export class CryptoError extends Error {
  constructor(
    message: string,
    public readonly code: CryptoErrorCode
  ) {
    super(message);
    this.name = "CryptoError";
  }
}

export class CryptoKeyMissingError extends CryptoError {
  constructor() {
    super("APP_MASTER_KEY is missing.", CryptoErrorCode.KEY_MISSING);
    this.name = "CryptoKeyMissingError";
  }
}

export class CryptoCiphertextCorruptedError extends CryptoError {
  constructor(message = "Encrypted payload is corrupted.") {
    super(message, CryptoErrorCode.CIPHERTEXT_CORRUPTED);
    this.name = "CryptoCiphertextCorruptedError";
  }
}

export class CryptoVersionMismatchError extends CryptoError {
  constructor(version: string) {
    super(
      `Unsupported encrypted payload version: ${version}.`,
      CryptoErrorCode.VERSION_MISMATCH
    );
    this.name = "CryptoVersionMismatchError";
  }
}

export class CryptoDecryptFailedError extends CryptoError {
  constructor(cause?: unknown) {
    super("Failed to decrypt credential.", CryptoErrorCode.DECRYPT_FAILED);
    this.name = "CryptoDecryptFailedError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

function loadMasterKey(): string {
  const masterKey = process.env.APP_MASTER_KEY;
  if (!masterKey) {
    throw new CryptoKeyMissingError();
  }
  return masterKey;
}

export function deriveKey(masterKey: string): Buffer {
  if (!masterKey) {
    throw new CryptoKeyMissingError();
  }
  return scryptSync(masterKey, KEY_DERIVATION_SALT, KEY_LENGTH_BYTES);
}

export function loadDerivedKey(): Buffer {
  return deriveKey(loadMasterKey());
}

function decodeBase64Segment(
  value: string,
  segmentName: string
): Buffer {
  if (!value || !BASE64_SEGMENT_PATTERN.test(value)) {
    throw new CryptoCiphertextCorruptedError(
      `${segmentName} is not valid base64 content.`
    );
  }

  const decoded = Buffer.from(value, "base64");
  const canonicalEncoded = decoded.toString("base64").replace(/=+$/u, "");
  const normalizedInput = value.replace(/=+$/u, "");

  if (decoded.length === 0 || canonicalEncoded !== normalizedInput) {
    throw new CryptoCiphertextCorruptedError(
      `${segmentName} is not valid canonical base64.`
    );
  }

  return decoded;
}

type ParsedEncryptedPayload = {
  iv: Buffer;
  authTag: Buffer;
  ciphertext: Buffer;
};

function parseEncryptedPayload(encoded: string): ParsedEncryptedPayload {
  const parts = encoded.split(":");
  if (parts.length !== ENCRYPTED_PARTS_COUNT) {
    throw new CryptoCiphertextCorruptedError(
      "Encrypted payload format must be version:iv:authTag:ciphertext."
    );
  }

  const [version, ivBase64, authTagBase64, ciphertextBase64] = parts;

  if (version !== CIPHER_VERSION) {
    throw new CryptoVersionMismatchError(version);
  }

  const iv = decodeBase64Segment(ivBase64, "iv");
  const authTag = decodeBase64Segment(authTagBase64, "authTag");
  const ciphertext = decodeBase64Segment(ciphertextBase64, "ciphertext");

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new CryptoCiphertextCorruptedError(
      `iv must be ${IV_LENGTH_BYTES} bytes.`
    );
  }

  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new CryptoCiphertextCorruptedError(
      `authTag must be ${AUTH_TAG_LENGTH_BYTES} bytes.`
    );
  }

  return { iv, authTag, ciphertext };
}

export function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
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

export function decryptWithKey(encrypted: string, key: Buffer): string {
  const { iv, authTag, ciphertext } = parseEncryptedPayload(encrypted);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch (error) {
    throw new CryptoDecryptFailedError(error);
  }
}

export function encrypt(plaintext: string): string {
  return encryptWithKey(plaintext, loadDerivedKey());
}

export function decrypt(encrypted: string): string {
  return decryptWithKey(encrypted, loadDerivedKey());
}
