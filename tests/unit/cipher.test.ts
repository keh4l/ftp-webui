import { describe, expect, it } from "vitest";

import {
  CryptoCiphertextCorruptedError,
  CryptoDecryptFailedError,
  CryptoVersionMismatchError,
  decryptWithKey,
  deriveKey,
  encryptWithKey,
} from "@/lib/crypto/cipher";

describe("cipher", () => {
  it("derives 32-byte key", () => {
    const key = deriveKey("demo-master-key");
    expect(key.length).toBe(32);
  });

  it("encrypt/decrypt roundtrip with same key", () => {
    const key = deriveKey("roundtrip-key");
    const encrypted = encryptWithKey("Demo#123", key);
    const plaintext = decryptWithKey(encrypted, key);
    expect(plaintext).toBe("Demo#123");
  });

  it("fails decrypt with wrong key", () => {
    const keyA = deriveKey("key-a");
    const keyB = deriveKey("key-b");
    const encrypted = encryptWithKey("secret", keyA);

    expect(() => decryptWithKey(encrypted, keyB)).toThrow(CryptoDecryptFailedError);
  });

  it("fails on corrupted payload", () => {
    const key = deriveKey("payload-key");
    expect(() => decryptWithKey("v1:bad:payload", key)).toThrow(CryptoCiphertextCorruptedError);
  });

  it("fails on version mismatch", () => {
    const key = deriveKey("version-key");
    const encrypted = encryptWithKey("hello", key);
    const tampered = encrypted.replace(/^v1:/, "v2:");

    expect(() => decryptWithKey(tampered, key)).toThrow(CryptoVersionMismatchError);
  });
});
