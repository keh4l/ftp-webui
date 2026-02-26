import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Audit logger — child of the main pino logger
// ---------------------------------------------------------------------------

const audit = logger.child({ module: "audit" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditAction =
  | "connection.create"
  | "connection.update"
  | "connection.delete"
  | "connection.test"
  | "file.batch_delete";

type AuditResult = "success" | "failure";

type AuditEntry = {
  action: AuditAction;
  target: Record<string, unknown>;
  result: AuditResult;
  error?: string;
};

// ---------------------------------------------------------------------------
// Sensitive field stripping
// ---------------------------------------------------------------------------

const SENSITIVE_KEYS = new Set([
  "password",
  "privateKey",
  "encryptedSecret",
  "secret",
  "token",
  "authorization",
]);

function stripSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    clean[key] = value;
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function auditLog(entry: AuditEntry): void {
  const sanitized: AuditEntry = {
    ...entry,
    target: stripSensitive(entry.target),
  };

  if (sanitized.result === "success") {
    audit.info(sanitized, `audit: ${sanitized.action}`);
  } else {
    audit.warn(sanitized, `audit: ${sanitized.action} failed`);
  }
}
