import { createHash } from "node:crypto";
import path from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";

import { Client, FTPError, FileType, type StringEncoding } from "basic-ftp";
import { ErrorCode } from "@/lib/constants";
import {
  AppError,
  authFailed,
  connectionNotFound,
  fileTooLarge,
  fileVersionConflict,
  invalidPath,
  tlsValidationFailed,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import type {
  ConnectionConfig,
  FileEntry,
  ProtocolAdapter,
  ProtocolExtensions,
  ReadTextOptions,
  TestResult,
  TextContent,
  TransferOptions,
  WriteTextOptions,
} from "@/lib/protocol/types";

type FtpAdapterExtensions = {
  timeoutMs?: number;
  insecure?: boolean;
  encoding?: string;
  encodingFallbacks?: string[];
  reconnectRetries?: number;
  allowSeparateTransferHost?: boolean;
};

type ReconnectOptions = { retryable?: boolean; operationName?: string };

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RECONNECT_RETRIES = 1;
const DEFAULT_ENCODINGS = ["utf8", "latin1"] as const;
const TIMEOUT_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
]);
const TLS_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

export class FtpAdapter implements ProtocolAdapter {
  private client: Client | null = null;
  private config: ConnectionConfig | null = null;
  private encodings: string[] = [...DEFAULT_ENCODINGS];
  private currentEncoding = "utf8";

  async connect(config: ConnectionConfig): Promise<void> {
    this.assertSupportedProtocol(config);
    await this.disconnect();
    const connected = await this.createConnectedClient(config);
    this.client = connected.client;
    this.config = config;
    this.currentEncoding = connected.encoding;
    this.encodings = connected.candidates;
    logger.info(
      {
        host: config.host,
        port: config.port,
        protocol: config.protocol,
        encoding: connected.encoding,
        passiveMode: true,
        serverBanner: connected.banner,
      },
      "FTP/FTPS connected"
    );
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    const cfg = this.config;
    try {
      this.client.close();
      logger.info({ host: cfg?.host, port: cfg?.port, protocol: cfg?.protocol }, "FTP/FTPS disconnected");
    } catch (error) {
      logger.error(
        { error, host: cfg?.host, port: cfg?.port, protocol: cfg?.protocol },
        "FTP/FTPS disconnect failed"
      );
    } finally {
      this.client = null;
      this.config = null;
      this.currentEncoding = "utf8";
      this.encodings = [...DEFAULT_ENCODINGS];
    }
  }

  async testConnection(config: ConnectionConfig): Promise<TestResult> {
    const startedAt = Date.now();
    let temp: Client | null = null;
    let banner: string | undefined;
    try {
      this.assertSupportedProtocol(config);
      const connected = await this.createConnectedClient(config);
      temp = connected.client;
      banner = connected.banner;
      await temp.list("/");
      return {
        success: true,
        latencyMs: Date.now() - startedAt,
        serverBanner: banner,
        extensions: {
          protocol: config.protocol,
          encoding: connected.encoding,
          passiveMode: true,
        },
      };
    } catch (error) {
      const mapped = this.mapToAppError(error, config.host);
      logger.error(
        { error, mappedCode: mapped.code, host: config.host, port: config.port, protocol: config.protocol },
        "FTP/FTPS testConnection failed"
      );
      return {
        success: false,
        latencyMs: Date.now() - startedAt,
        error: { message: mapped.message, code: mapped.code, details: mapped.details },
        serverBanner: banner,
      };
    } finally {
      temp?.close();
    }
  }

  async list(remotePath: string): Promise<FileEntry[]> {
    const p = this.normalizeRemotePath(remotePath, true);
    return this.withEncodingFallback(async () => {
      const listed = await this.withReconnect((client) => client.list(p), { operationName: "list" });
      return listed.map((item) => this.toFileEntry(item, p));
    });
  }

  async upload(source: string | Buffer | Readable, remotePath: string, opts?: TransferOptions): Promise<void> {
    const p = this.normalizeRemotePath(remotePath, false);
    const total = await this.getUploadTotal(source);
    const retryable = typeof source === "string" || Buffer.isBuffer(source);
    await this.withReconnect(
      async (client) => {
        const payload = this.toUploadSource(source);
        if (opts?.onProgress) {
          client.trackProgress((info) => {
            if (info.type === "upload") opts.onProgress?.(info.bytes, total);
          });
        }
        try {
          await this.ensureParentDirectory(client, p);
          await client.uploadFrom(payload, p);
        } finally {
          client.trackProgress();
        }
      },
      { retryable, operationName: "upload" }
    );
  }

  async download(remotePath: string): Promise<Readable> {
    const p = this.normalizeRemotePath(remotePath, false);
    const stream = new PassThrough();
    void this.withReconnect((client) => client.downloadTo(stream, p), {
      retryable: false,
      operationName: "download",
    }).catch((error) => {
      logger.error({ error, remotePath: p }, "FTP download failed");
      stream.destroy(error instanceof Error ? error : new Error(String(error)));
    });
    return stream;
  }

  async readText(remotePath: string, opts?: ReadTextOptions): Promise<TextContent> {
    const p = this.normalizeRemotePath(remotePath, false);
    const current = await this.stat(p);
    const maxSize = this.getMaxSize(opts?.maxSize);
    if (current.size !== null && maxSize !== null && current.size > maxSize) {
      throw fileTooLarge(current.size, maxSize);
    }
    const contentBuffer = await this.withEncodingFallback(() =>
      this.withReconnect((client) => this.downloadToBuffer(client, p), { operationName: "readText" })
    );
    const encoding = this.resolveTextEncoding(opts?.extensions);
    return {
      content: contentBuffer.toString(encoding),
      etag: this.makeEtag(current.modifiedAt, current.size),
      encoding,
      extensions: { remotePath: p },
    };
  }

  async writeText(remotePath: string, content: string, opts?: WriteTextOptions): Promise<void> {
    const p = this.normalizeRemotePath(remotePath, false);
    if (opts?.etag !== undefined) {
      try {
        const current = await this.stat(p);
        if (this.makeEtag(current.modifiedAt, current.size) !== opts.etag) throw fileVersionConflict(p);
      } catch (error) {
        if (error instanceof AppError && error.code === ErrorCode.INVALID_PATH) throw fileVersionConflict(p);
        throw error;
      }
    }
    const encoding = this.resolveTextEncoding(opts?.extensions, opts?.encoding);
    await this.withReconnect(
      async (client) => {
        await this.ensureParentDirectory(client, p);
        await client.uploadFrom(Readable.from(Buffer.from(content, encoding)), p);
      },
      { operationName: "writeText" }
    );
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const oldP = this.normalizeRemotePath(oldPath, false);
    const newP = this.normalizeRemotePath(newPath, false);
    await this.withReconnect(
      async (client) => {
        await this.ensureParentDirectory(client, newP);
        await client.rename(oldP, newP);
      },
      { operationName: "rename" }
    );
  }

  async delete(remotePath: string): Promise<void> {
    const p = this.normalizeRemotePath(remotePath, false);
    await this.withReconnect((client) => client.remove(p), { operationName: "delete" });
  }

  async mkdir(remotePath: string): Promise<void> {
    const p = this.normalizeRemotePath(remotePath, true);
    await this.withReconnect(
      async (client) => {
        const cwd = await client.pwd();
        try {
          await client.ensureDir(p);
        } finally {
          await client.cd(cwd);
        }
      },
      { operationName: "mkdir" }
    );
  }

  async stat(remotePath: string): Promise<FileEntry> {
    const p = this.normalizeRemotePath(remotePath, true);
    if (p === "/") return { name: "/", path: "/", type: "directory", size: null, modifiedAt: null };
    const parent = path.posix.dirname(p);
    const base = path.posix.basename(p);
    const entry = (await this.list(parent)).find((item) => item.name === base);
    if (!entry) throw invalidPath(p);
    return entry;
  }

  private async withReconnect<T>(operation: (client: Client) => Promise<T>, opts?: ReconnectOptions): Promise<T> {
    const cfg = this.requireConfig();
    const retryable = opts?.retryable ?? true;
    try {
      const c = this.requireClient();
      if (c.closed) await this.connect(cfg);
      return await operation(this.requireClient());
    } catch (error) {
      if (retryable && this.shouldReconnect(error)) {
        const retries = this.getReconnectRetries(cfg.extensions);
        for (let i = 1; i <= retries; i += 1) {
          try {
            logger.warn(
              { attempt: i, retries, operation: opts?.operationName, host: cfg.host, protocol: cfg.protocol },
              "FTP operation failed, trying reconnect"
            );
            await this.connect(cfg);
            return await operation(this.requireClient());
          } catch (retryError) {
            if (i === retries) {
              logger.error(
                { error: retryError, operation: opts?.operationName, host: cfg.host, protocol: cfg.protocol },
                "FTP reconnect retry exhausted"
              );
              throw this.mapToAppError(retryError, cfg.host);
            }
          }
        }
      }
      throw this.mapToAppError(error, cfg.host);
    }
  }

  private async withEncodingFallback<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.shouldRetryWithNextEncoding(error)) throw error;
      const cfg = this.requireConfig();
      const idx = this.encodings.indexOf(this.currentEncoding);
      const next = this.encodings[idx + 1];
      if (!next) throw error;
      logger.warn(
        { host: cfg.host, protocol: cfg.protocol, currentEncoding: this.currentEncoding, nextEncoding: next },
        "Retrying FTP operation with encoding fallback"
      );
      await this.connect({
        ...cfg,
        extensions: {
          ...(cfg.extensions ?? {}),
          encoding: next,
          encodingFallbacks: this.encodings.slice(idx + 2),
        },
      });
      return operation();
    }
  }

  private async createConnectedClient(config: ConnectionConfig): Promise<{
    client: Client;
    banner: string;
    encoding: string;
    candidates: string[];
  }> {
    const ext = this.readExtensions(config.extensions);
    const candidates = this.resolveEncodingCandidates(ext.encoding, ext.encodingFallbacks);
    let lastError: unknown;
    for (const encoding of candidates) {
      const client = this.newClient(ext.timeoutMs, ext.allowSeparateTransferHost);
      try {
        client.ftp.encoding = encoding as StringEncoding;
        const response = await client.access(this.makeAccessOptions(config, ext.insecure));
        return { client, banner: response.message, encoding, candidates };
      } catch (error) {
        lastError = error;
        client.close();
        logger.warn(
          { error, host: config.host, protocol: config.protocol, encoding },
          "FTP/FTPS connect attempt failed"
        );
      }
    }
    throw this.mapToAppError(lastError, config.host);
  }

  private makeAccessOptions(config: ConnectionConfig, insecure?: boolean) {
    const isFtps = config.protocol === "ftps";
    const rejectUnauthorized = !(insecure === true);
    if (isFtps && insecure === true) {
      logger.warn(
        { host: config.host, protocol: config.protocol },
        "FTPS insecure mode enabled: TLS certificate validation is disabled"
      );
    }
    return {
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      secure: isFtps,
      secureOptions: isFtps ? { rejectUnauthorized } : undefined,
    };
  }

  private newClient(timeoutMs?: number, allowSeparateTransferHost?: boolean): Client {
    return new Client(timeoutMs ?? DEFAULT_TIMEOUT_MS, {
      allowSeparateTransferHost: allowSeparateTransferHost ?? true,
    });
  }

  private async ensureParentDirectory(client: Client, remoteFilePath: string): Promise<void> {
    const parent = path.posix.dirname(remoteFilePath);
    if (parent === "." || parent === "/") return;
    const cwd = await client.pwd();
    try {
      await client.ensureDir(parent);
    } finally {
      await client.cd(cwd);
    }
  }

  private async downloadToBuffer(client: Client, remotePath: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        callback();
      },
    });
    await client.downloadTo(sink, remotePath);
    return Buffer.concat(chunks);
  }

  private toFileEntry(item: {
    name: string;
    type: FileType;
    size: number;
    modifiedAt?: Date;
    permissions?: unknown;
  }, basePath: string): FileEntry {
    const fullPath = basePath === "/" ? `/${item.name}` : `${basePath.replace(/\/+$/, "")}/${item.name}`;
    return {
      name: item.name,
      path: fullPath,
      type: this.mapFileType(item.type),
      size: Number.isFinite(item.size) ? item.size : null,
      modifiedAt: item.modifiedAt?.toISOString() ?? null,
      permissions: item.permissions?.toString() ?? undefined,
    };
  }

  private mapFileType(t: FileType): FileEntry["type"] {
    if (t === FileType.File) return "file";
    if (t === FileType.Directory) return "directory";
    if (t === FileType.SymbolicLink) return "symlink";
    return "unknown";
  }

  private normalizeRemotePath(input: string, allowRoot: boolean): string {
    const raw = input.trim();
    if (!raw) throw invalidPath(input);
    const slash = raw.replace(/\\/g, "/");
    const segments = slash.split("/").filter(Boolean);
    if (segments.some((s) => s === ".." || s.includes("\u0000"))) throw invalidPath(input);
    const normalized = path.posix.normalize(slash.startsWith("/") ? slash : `/${slash}`);
    if (!allowRoot && normalized === "/") throw invalidPath(input);
    return normalized;
  }

  private shouldReconnect(error: unknown): boolean {
    if (error instanceof AppError || error instanceof FTPError) return false;
    const e = error as NodeJS.ErrnoException;
    if (typeof e?.code === "string" && TIMEOUT_CODES.has(e.code)) return true;
    return error instanceof Error && /client is closed|timed out|timeout/i.test(error.message);
  }

  private shouldRetryWithNextEncoding(error: unknown): boolean {
    return error instanceof Error && /encoding|directory listing|can't parse|non-utf|mlsd|list/i.test(error.message);
  }

  private mapToAppError(error: unknown, host: string): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof FTPError) {
      if (error.code === 530 || error.code === 332) return authFailed(host);
      if (error.code === 550 || error.code === 553) return invalidPath(error.message);
      return new AppError({
        code: ErrorCode.CONNECTION_TIMEOUT,
        message: error.message,
        details: { host, ftpCode: error.code },
      });
    }
    const e = error as NodeJS.ErrnoException;
    if ((typeof e?.code === "string" && TLS_CODES.has(e.code)) || (error instanceof Error && /tls|certificate|ssl/i.test(error.message))) {
      return tlsValidationFailed(host);
    }
    if ((typeof e?.code === "string" && TIMEOUT_CODES.has(e.code)) || (error instanceof Error && /timed out|timeout/i.test(error.message))) {
      return new AppError({
        code: ErrorCode.CONNECTION_TIMEOUT,
        message: error instanceof Error ? error.message : "Connection timeout",
        details: { host, originalCode: e?.code },
      });
    }
    if (error instanceof Error && /auth|login/i.test(error.message)) return authFailed(host);
    return new AppError({
      code: ErrorCode.CONNECTION_TIMEOUT,
      message: error instanceof Error ? error.message : "FTP operation failed",
      details: { host },
    });
  }

  private resolveEncodingCandidates(preferred?: string, fallbacks?: string[]): string[] {
    const merged = [preferred, ...(fallbacks ?? []), ...DEFAULT_ENCODINGS]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim().toLowerCase());
    return [...new Set(merged)];
  }

  private getReconnectRetries(extensions?: ProtocolExtensions): number {
    const val = this.readExtensions(extensions).reconnectRetries;
    if (typeof val !== "number" || Number.isNaN(val)) return DEFAULT_RECONNECT_RETRIES;
    return Math.max(0, Math.floor(val));
  }

  private readExtensions(extensions?: ProtocolExtensions): FtpAdapterExtensions {
    if (!extensions || typeof extensions !== "object") return {};
    const r = extensions as Record<string, unknown>;
    return {
      timeoutMs: this.toNumber(r.timeoutMs),
      insecure: this.toBoolean(r.insecure),
      encoding: this.toString(r.encoding),
      encodingFallbacks: this.toStringArray(r.encodingFallbacks),
      reconnectRetries: this.toNumber(r.reconnectRetries),
      allowSeparateTransferHost: this.toBoolean(r.allowSeparateTransferHost),
    };
  }

  private getMaxSize(maxSize?: number): number | null {
    if (maxSize === undefined) return null;
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      throw new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: "maxSize must be a positive number",
        details: { maxSize },
      });
    }
    return Math.floor(maxSize);
  }

  private resolveTextEncoding(extensions?: ProtocolExtensions, explicit?: string): BufferEncoding {
    const candidate = explicit ?? this.readExtensions(extensions).encoding ?? "utf8";
    if (!Buffer.isEncoding(candidate)) {
      throw new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Unsupported text encoding: ${candidate}`,
        details: { encoding: candidate },
      });
    }
    return candidate;
  }

  private makeEtag(modifiedAt: string | null, size: number | null): string | null {
    if (modifiedAt === null || size === null) return null;
    return createHash("md5").update(`${modifiedAt}:${size}`).digest("hex");
  }

  private async getUploadTotal(source: string | Buffer | Readable): Promise<number | undefined> {
    if (Buffer.isBuffer(source)) return source.length;
    if (typeof source !== "string") return undefined;
    try {
      const fs = await import("node:fs/promises");
      return (await fs.stat(source)).size;
    } catch {
      return undefined;
    }
  }

  private toUploadSource(source: string | Buffer | Readable): string | Readable {
    return Buffer.isBuffer(source) ? Readable.from(source) : source;
  }

  private toBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
  }

  private toNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private toString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private toStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const list = value.filter((item): item is string => typeof item === "string");
    return list.length > 0 ? list : undefined;
  }

  private assertSupportedProtocol(config: ConnectionConfig): void {
    if (config.protocol === "ftp" || config.protocol === "ftps") return;
    throw new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message: `Unsupported protocol for FTP adapter: ${config.protocol}`,
      details: { protocol: config.protocol },
    });
  }

  private requireClient(): Client {
    if (!this.client) throw connectionNotFound("ftp-adapter");
    return this.client;
  }

  private requireConfig(): ConnectionConfig {
    if (!this.config) throw connectionNotFound("ftp-adapter");
    return this.config;
  }
}
