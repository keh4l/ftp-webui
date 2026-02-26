import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Readable } from "node:stream";

import { fileTooLarge, invalidPath } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ProtocolAdapter } from "@/lib/protocol/types";

export type TransferOptions = {
  onProgress?: (transferred: number, total?: number) => void;
  maxFileSize?: number;
};

export type TransferResult = {
  success: boolean;
  bytesTransferred: number;
  durationMs: number;
  error?: string;
};

export type TransferState = "pending" | "transferring" | "completed" | "failed";

export type TransferProgress = {
  transferred: number;
  total?: number;
};

export type TransferStatus = {
  id: string;
  state: TransferState;
  progress?: TransferProgress;
  error?: string;
};

export type AdapterResolver =
  | ((connectionId: string) => Promise<ProtocolAdapter>)
  | ((connectionId: string) => ProtocolAdapter);

export class TransferService {
  private readonly transferStatuses = new Map<string, TransferStatus>();

  constructor(private readonly resolveAdapter: AdapterResolver) {}

  async upload(
    connectionId: string,
    source: string | Buffer | Readable,
    remotePath: string,
    opts?: TransferOptions,
  ): Promise<TransferResult> {
    const transferId = randomUUID();
    const startedAt = Date.now();
    const normalizedPath = normalizeAndValidateRemotePath(remotePath);

    this.transferStatuses.set(transferId, {
      id: transferId,
      state: "pending",
    });

    let bytesTransferred = 0;

    try {
      if (
        opts?.maxFileSize !== undefined &&
        Buffer.isBuffer(source) &&
        source.byteLength > opts.maxFileSize
      ) {
        throw fileTooLarge(source.byteLength, opts.maxFileSize);
      }

      const adapter = await this.resolveAdapter(connectionId);
      this.setStatus(transferId, { state: "transferring", progress: { transferred: 0 } });

      logger.info(
        {
          connectionId,
          transferId,
          remotePath: normalizedPath,
          sourceType: getSourceType(source),
        },
        "Upload transfer started",
      );

      await adapter.upload(source, normalizedPath, {
        onProgress: (transferred, total) => {
          bytesTransferred = transferred;

          this.setStatus(transferId, {
            state: "transferring",
            progress: {
              transferred,
              total,
            },
          });

          opts?.onProgress?.(transferred, total);
        },
      });

      const durationMs = Date.now() - startedAt;
      this.setStatus(transferId, {
        state: "completed",
        progress: { transferred: bytesTransferred },
      });

      logger.info(
        {
          connectionId,
          transferId,
          remotePath: normalizedPath,
          bytesTransferred,
          durationMs,
        },
        "Upload transfer completed",
      );

      return {
        success: true,
        bytesTransferred,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = toErrorMessage(error);

      this.setStatus(transferId, {
        state: "failed",
        progress: { transferred: bytesTransferred },
        error: errorMessage,
      });

      logger.error(
        {
          connectionId,
          transferId,
          remotePath: normalizedPath,
          durationMs,
          bytesTransferred,
          error,
        },
        "Upload transfer failed",
      );

      return {
        success: false,
        bytesTransferred,
        durationMs,
        error: errorMessage,
      };
    }
  }

  async download(connectionId: string, remotePath: string): Promise<Readable> {
    const transferId = randomUUID();
    const normalizedPath = normalizeAndValidateRemotePath(remotePath);

    this.transferStatuses.set(transferId, {
      id: transferId,
      state: "pending",
    });

    logger.info(
      {
        connectionId,
        transferId,
        remotePath: normalizedPath,
      },
      "Download transfer started",
    );

    try {
      const adapter = await this.resolveAdapter(connectionId);
      const stream = await adapter.download(normalizedPath);

      let transferred = 0;

      this.setStatus(transferId, {
        state: "transferring",
        progress: { transferred: 0 },
      });

      stream.on("data", (chunk: unknown) => {
        transferred += getChunkByteLength(chunk);
        this.setStatus(transferId, {
          state: "transferring",
          progress: { transferred },
        });
      });

      stream.once("end", () => {
        this.setStatus(transferId, {
          state: "completed",
          progress: { transferred },
        });

        logger.info(
          {
            connectionId,
            transferId,
            remotePath: normalizedPath,
            bytesTransferred: transferred,
          },
          "Download transfer completed",
        );
      });

      stream.once("error", (error) => {
        const errorMessage = toErrorMessage(error);

        this.setStatus(transferId, {
          state: "failed",
          progress: { transferred },
          error: errorMessage,
        });

        logger.error(
          {
            connectionId,
            transferId,
            remotePath: normalizedPath,
            bytesTransferred: transferred,
            error,
          },
          "Download transfer failed",
        );
      });

      return stream;
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      this.setStatus(transferId, {
        state: "failed",
        error: errorMessage,
      });

      logger.error(
        {
          connectionId,
          transferId,
          remotePath: normalizedPath,
          error,
        },
        "Download transfer failed before stream start",
      );

      throw error;
    }
  }

  getTransferStatus(transferId: string): TransferStatus | undefined {
    const status = this.transferStatuses.get(transferId);
    if (!status) {
      return undefined;
    }

    return {
      ...status,
      progress: status.progress ? { ...status.progress } : undefined,
    };
  }

  private setStatus(transferId: string, patch: Omit<TransferStatus, "id">): void {
    const current = this.transferStatuses.get(transferId);
    if (!current) {
      return;
    }

    this.transferStatuses.set(transferId, {
      ...current,
      ...patch,
    });
  }
}

function normalizeAndValidateRemotePath(remotePath: string): string {
  if (remotePath.includes("\0")) {
    throw invalidPath(remotePath);
  }

  const normalized = path.posix.normalize(remotePath.replaceAll("\\", "/"));
  if (normalized === "" || normalized === "." || normalized === "..") {
    throw invalidPath(remotePath);
  }

  const absolutePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (absolutePath.split("/").some((part) => part === "..")) {
    throw invalidPath(remotePath);
  }

  return absolutePath;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getChunkByteLength(chunk: unknown): number {
  if (typeof chunk === "string") {
    return Buffer.byteLength(chunk);
  }

  if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
    return chunk.byteLength;
  }

  return 0;
}

function getSourceType(source: string | Buffer | Readable): "path" | "buffer" | "stream" {
  if (typeof source === "string") {
    return "path";
  }

  if (Buffer.isBuffer(source)) {
    return "buffer";
  }

  return "stream";
}
