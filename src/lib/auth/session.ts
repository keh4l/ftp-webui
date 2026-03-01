import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";

export const SESSION_COOKIE_NAME = "ftp-webui-session";
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

type SessionCookieSecureMode = "auto" | "always" | "never";
type RequestLike = Pick<Request, "headers" | "url">;

type SessionPayload = {
  username: string;
};

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

function getSessionCookieOptions(request: RequestLike) {
  return {
    ...baseSessionCookieOptions,
    secure: resolveSessionCookieSecure(request),
  };
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(encodedPayload: string): SessionPayload | null {
  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<SessionPayload>;
    if (typeof parsed.username !== "string" || parsed.username.length === 0) {
      return null;
    }

    return { username: parsed.username };
  } catch {
    return null;
  }
}

function signSession(timestamp: string, encodedPayload: string): string {
  return createHmac("sha256", env.APP_MASTER_KEY)
    .update(`${timestamp}.${encodedPayload}`)
    .digest("base64url");
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionToken(username: string): string {
  const timestamp = Date.now().toString();
  const encodedPayload = encodePayload({ username });
  const signature = signSession(timestamp, encodedPayload);

  return `${timestamp}.${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
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

  const expectedSignature = signSession(timestamp, encodedPayload);
  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  return decodePayload(encodedPayload);
}

export function setSessionCookie(response: NextResponse, username: string, request: RequestLike): void {
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(username), getSessionCookieOptions(request));
}

export function clearSessionCookie(response: NextResponse, request: RequestLike): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(request),
    maxAge: 0,
  });
}

export function getSessionFromRequest(request: Pick<NextRequest, "cookies">): SessionPayload | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
