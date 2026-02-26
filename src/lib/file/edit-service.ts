import path from "node:path";

import { fileTooLarge, invalidPath } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ProtocolAdapter, TextContent, WriteTextOptions } from "@/lib/protocol/types";

export const DEFAULT_MAX_EDIT_SIZE = 1024 * 1024;

export const EDITABLE_EXTENSIONS = new Set<string>([
  ".txt",
  ".md",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".csv",
  ".log",
  ".ini",
  ".conf",
  ".cfg",
  ".env",
  ".sh",
  ".bash",
  ".html",
  ".css",
  ".js",
  ".ts",
  ".py",
  ".rb",
  ".php",
  ".sql",
  ".toml",
]);

export type EditOptions = {
  maxSize?: number;
  encoding?: string;
};

export type SaveOptions = {
  etag?: string;
  encoding?: string;
};

export type EditableCheck = {
  editable: boolean;
  reason?: string;
  size?: number;
};

export type AdapterResolver = (connectionId: string) => Promise<ProtocolAdapter>;

export class EditService {
  constructor(private readonly getAdapter: AdapterResolver) {}

  async readText(connectionId: string, remotePath: string, opts?: EditOptions): Promise<TextContent> {
    const safePath = validateRemotePath(remotePath);
    const adapter = await this.getAdapter(connectionId);
    const maxSize = opts?.maxSize ?? DEFAULT_MAX_EDIT_SIZE;
    const file = await adapter.stat(safePath);

    if (file.size !== null && file.size > maxSize) {
      throw fileTooLarge(file.size, maxSize);
    }

    const text = await adapter.readText(safePath, { maxSize });

    logger.info(
      {
        connectionId,
        remotePath: safePath,
        etag: text.etag,
        encoding: text.encoding,
        size: file.size,
      },
      "Text file read for online editing",
    );

    return text;
  }

  async writeText(
    connectionId: string,
    remotePath: string,
    content: string,
    opts?: SaveOptions,
  ): Promise<void> {
    const safePath = validateRemotePath(remotePath);
    const adapter = await this.getAdapter(connectionId);
    const writeOptions: WriteTextOptions = {
      etag: opts?.etag,
      encoding: opts?.encoding,
    };

    await adapter.writeText(safePath, content, writeOptions);

    logger.info(
      {
        connectionId,
        remotePath: safePath,
        etagProvided: opts?.etag !== undefined,
        encoding: opts?.encoding,
        contentLength: content.length,
      },
      "Text file saved from online editing",
    );
  }

  async isEditable(connectionId: string, remotePath: string): Promise<EditableCheck> {
    const safePath = validateRemotePath(remotePath);
    const adapter = await this.getAdapter(connectionId);
    const file = await adapter.stat(safePath);
    const size = file.size ?? undefined;

    if (file.type !== "file") {
      return {
        editable: false,
        reason: "not_file",
        size,
      };
    }

    if (size !== undefined && size > DEFAULT_MAX_EDIT_SIZE) {
      return {
        editable: false,
        reason: "file_too_large",
        size,
      };
    }

    const extension = path.posix.extname(safePath.replaceAll("\\", "/")).toLowerCase();
    if (!EDITABLE_EXTENSIONS.has(extension)) {
      return {
        editable: false,
        reason: "unsupported_extension",
        size,
      };
    }

    return {
      editable: true,
      size,
    };
  }
}

function validateRemotePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw invalidPath(input);
  }

  if (trimmed.includes("\u0000")) {
    throw invalidPath(input);
  }

  const segments = trimmed.replaceAll("\\", "/").split("/").filter(Boolean);
  if (segments.some((segment) => segment === "..")) {
    throw invalidPath(input);
  }

  return trimmed;
}
