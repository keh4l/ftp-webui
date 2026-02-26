import path from "node:path";

import { invalidPath } from "@/lib/errors";

const PATH_TRAVERSAL_SEGMENT = "..";
const NULL_BYTE = "\u0000";

export function normalizePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw invalidPath(input);
  }

  if (trimmed.includes(NULL_BYTE)) {
    throw invalidPath(input);
  }

  const normalizedSlashes = trimmed.replace(/\\/g, "/");
  const rawSegments = normalizedSlashes.split("/").filter(Boolean);
  if (rawSegments.some((segment) => segment === PATH_TRAVERSAL_SEGMENT)) {
    throw invalidPath(input);
  }

  const normalized = path.posix.normalize(
    normalizedSlashes.startsWith("/") ? normalizedSlashes : `/${normalizedSlashes}`,
  );

  const normalizedSegments = normalized.split("/").filter(Boolean);
  if (normalizedSegments.some((segment) => segment === PATH_TRAVERSAL_SEGMENT)) {
    throw invalidPath(input);
  }

  if (!normalized.startsWith("/")) {
    throw invalidPath(input);
  }

  return normalized;
}

export function validatePath(input: string): string {
  return normalizePath(input);
}
