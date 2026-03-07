import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

export const SESSION_COOKIE_NAME = "ftp-webui-session";
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

type SessionCookieSecureMode = "auto" | "always" | "never";
type RequestLike = Pick<Request, "headers" | "url">;

type SessionPayload = {
  username: string;
};

type SessionCookieOptions = typeof baseSessionCookieOptions & {
  secure: boolean;
};

type ResponseWithCookies = {
  cookies: {
    set: (name: string, value: string, options: SessionCookieOptions) => void;
  };
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let sessionKeyPromise: Promise<CryptoKey> | null = null;

const baseSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

function resolveSessionCookieSecureMode(): SessionCookieSecureMode {
  return env.SESSION_COOKIE_SECURE;
}

function resolveSessionCookieSecure(request: RequestLike): boolean {
  const mode = resolveSessionCookieSecureMode();
  if (mode === "always") {
    return true;
  }

  if (mode === "never") {
    return false;
  }

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();
  if (forwardedProto === "https") {
    return true;
  }

  if (forwardedProto === "http") {
    return false;
  }

  return new URL(request.url).protocol === "https:";
}

function getSessionCookieOptions(request: RequestLike): SessionCookieOptions {
  return {
    ...baseSessionCookieOptions,
    secure: resolveSessionCookieSecure(request),
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeUtf8(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function decodeUtf8(value: Uint8Array): string {
  return textDecoder.decode(value);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function getWebCrypto(): Crypto {
  if (typeof globalThis.crypto === "undefined") {
    throw new Error("Web Crypto API is unavailable in this runtime");
  }

  return globalThis.crypto;
}

async function getSessionKey(): Promise<CryptoKey> {
  sessionKeyPromise ??= getWebCrypto().subtle.importKey(
    "raw",
    toArrayBuffer(encodeUtf8(env.APP_MASTER_KEY)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return sessionKeyPromise;
}

function encodePayload(payload: SessionPayload): string {
  return toBase64Url(encodeUtf8(JSON.stringify(payload)));
}

function decodePayload(encodedPayload: string): SessionPayload | null {
  try {
    const decoded = decodeUtf8(fromBase64Url(encodedPayload));
    const parsed = JSON.parse(decoded) as Partial<SessionPayload>;
    if (typeof parsed.username !== "string" || parsed.username.length === 0) {
      return null;
    }

    return { username: parsed.username };
  } catch {
    return null;
  }
}

async function signSession(timestamp: string, encodedPayload: string): Promise<string> {
  const signature = await getWebCrypto().subtle.sign(
    "HMAC",
    await getSessionKey(),
    toArrayBuffer(encodeUtf8(`${timestamp}.${encodedPayload}`)),
  );

  return toBase64Url(new Uint8Array(signature));
}

function safeCompare(left: string, right: string): boolean {
  const leftBytes = fromBase64Url(left);
  const rightBytes = fromBase64Url(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }

  return difference === 0;
}

export async function createSessionToken(username: string): Promise<string> {
  const timestamp = Date.now().toString();
  const encodedPayload = encodePayload({ username });
  const signature = await signSession(timestamp, encodedPayload);

  return `${timestamp}.${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [timestamp, encodedPayload, signature] = parts;
  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) {
    return null;
  }

  if (Date.now() - issuedAt > SESSION_MAX_AGE_SECONDS * 1000) {
    return null;
  }

  const expectedSignature = await signSession(timestamp, encodedPayload);
  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  return decodePayload(encodedPayload);
}

export async function setSessionCookie(response: ResponseWithCookies, username: string, request: RequestLike): Promise<void> {
  response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(username), getSessionCookieOptions(request));
}

export function clearSessionCookie(response: ResponseWithCookies, request: RequestLike): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(request),
    maxAge: 0,
  });
}

export async function getSessionFromRequest(request: Pick<NextRequest, "cookies">): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
