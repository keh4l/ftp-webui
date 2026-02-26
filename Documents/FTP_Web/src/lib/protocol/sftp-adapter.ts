import { createHash, timingSafeEqual } from "node:crypto";
import { posix as posixPath } from "node:path";
import type { Readable } from "node:stream";

import SftpClient from "ssh2-sftp-client";

import { ErrorCode } from "@/lib/constants";
import {
  AppError,
  authFailed,
  connectionNotFound,
  fileTooLarge,
  fileVersionConflict,
  hostKeyMismatch,
  invalidPath,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import type {
  ConnectionConfig,
  FileEntry,
  FileType,
  ProtocolAdapter,
  ProtocolExtensions,
  ReadTextOptions,
  TestResult,
  TextContent,
  TransferOptions,
  WriteTextOptions,
} from "@/lib/protocol/types";

type SftpAdapterExtensions = {
  privateKey?: string | Buffer;
  passphrase?: string;
  strictHostKey?: boolean;
  hostFingerprint?: string;
  hostHash?: string;
  readyTimeoutMs?: number;
  timeoutMs?: number;
  retries?: number;
  retryFactor?: number;
  retryMinTimeoutMs?: number;
  useFastPut?: boolean;
  useFastGet?: boolean;
  fastConcurrency?: number;
  fastChunkSize?: number;
};

type SftpConnectOptions = Parameters<SftpClient["connect"]>[0];
type SftpPutOptions = Parameters<SftpClient["put"]>[2];
type SftpFastPutOptions = Parameters<SftpClient["fastPut"]>[2];
type SftpFastGetOptions = Parameters<SftpClient["fastGet"]>[2];
type SftpListEntry = Awaited<ReturnType<SftpClient["list"]>>[number];
type SftpFileStat = Awaited<ReturnType<SftpClient["stat"]>>;

const DEFAULT_READY_TIMEOUT_MS = 20_000;
const DEFAULT_SOCKET_TIMEOUT_MS = 20_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_FACTOR = 2;
const DEFAULT_RETRY_MIN_TIMEOUT_MS = 1_000;
const DEFAULT_TEXT_ENCODING = "utf-8";

export class SftpAdapter implements ProtocolAdapter {
  private client: SftpClient | null = null;

  private connectionTag = "sftp-adapter";

  async connect(config: ConnectionConfig): Promise<void> {
    await this.disconnect();

    const extensions = this.parseExtensions(config.extensions);
    const strictHostKey = extensions.strictHostKey !== false;
    const client = this.createClient(this.connectionTag);

    try {
      logger.info(
        {
          host: config.host,
          port: config.port,
          username: config.username,
          strictHostKey,
        },
        "SFTP connecting",
      );

      await client.connect(this.buildConnectOptions(config, extensions, strictHostKey));
      this.client = client;

      logger.info(
        {
          host: config.host,
          port: config.port,
          username: config.username,
        },
        "SFTP connected",
      );
    } catch (error) {
      await this.safeEnd(client);
      const mapped = this.mapError(error, config.host);

      logger.error(
        {
          host: config.host,
          port: config.port,
          username: config.username,
          code: mapped.code,
          details: mapped.details,
        },
        "SFTP connection failed",
      );

      throw mapped;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;

    try {
      await client.end();
      logger.info("SFTP disconnected");
    } catch (error) {
      logger.warn({ error }, "SFTP disconnect reported an error");
    }
  }

  async testConnection(config: ConnectionConfig): Promise<TestResult> {
    const startedAt = Date.now();
    const extensions = this.parseExtensions(config.extensions);
    const strictHostKey = extensions.strictHostKey !== false;
    const probeClient = this.createClient(`${this.connectionTag}-probe`);

    try {
      await probeClient.connect(this.buildConnectOptions(config, extensions, strictHostKey));
      await probeClient.list("/");

      return {
        success: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      const mapped = this.mapError(error, config.host);

      logger.error(
        {
          host: config.host,
          port: config.port,
          username: config.username,
          code: mapped.code,
          details: mapped.details,
        },
        "SFTP testConnection failed",
      );

      return {
        success: false,
        latencyMs: Date.now() - startedAt,
        error: {
          message: mapped.message,
          code: mapped.code,
          details: mapped.details,
        },
      };
    } finally {
      await this.safeEnd(probeClient);
    }
  }

  async list(remotePath: string): Promise<FileEntry[]> {
    const client = this.requireClient();

    try {
      const entries = await client.list(remotePath);
      return entries.map((entry) => this.mapListEntry(remotePath, entry));
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  async upload(
    source: string | Buffer | Readable,
    remotePath: string,
    opts?: TransferOptions,
  ): Promise<void> {
    const client = this.requireClient();
    const extensions = this.parseExtensions(opts?.extensions);

    try {
      if (typeof source === "string" && extensions.useFastPut === true) {
        await client.fastPut(source, remotePath, this.buildFastPutOptions(opts, extensions));
        return;
      }

      await client.put(source, remotePath, this.buildPutOptions(opts));
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  async download(remotePath: string): Promise<Readable> {
    const client = this.requireClient();

    try {
      return client.createReadStream(remotePath) as unknown as Readable;
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  async readText(remotePath: string, opts?: ReadTextOptions): Promise<TextContent> {
    const client = this.requireClient();
    const maxSize = opts?.maxSize;
    const file = await this.stat(remotePath);

    if (maxSize !== undefined && file.size !== null && file.size > maxSize) {
      throw fileTooLarge(file.size, maxSize);
    }

    try {
      const data = await client.get(remotePath);
      const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
      const etag = this.buildEtag(file.modifiedAt, file.size);

      return {
        content: payload.toString(DEFAULT_TEXT_ENCODING),
        etag,
        encoding: DEFAULT_TEXT_ENCODING,
      };
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  async writeText(remotePath: string, content: string, opts?: WriteTextOptions): Promise<void> {
    const client = this.requireClient();
    const expectedEtag = opts?.etag;
    const encoding = (opts?.encoding ?? DEFAULT_TEXT_ENCODING) as BufferEncoding;

    if (expectedEtag) {
      try {
        const current = await this.stat(remotePath);
        const currentEtag = this.buildEtag(current.modifiedAt, current.size);

        if (currentEtag !== expectedEtag) {
          throw fileVersionConflict(remotePath);
        }
      } catch (error) {
        const mapped = this.mapError(error, undefined, remotePath);
        if (mapped.code === ErrorCode.INVALID_PATH) {
          throw fileVersionConflict(remotePath);
        }
        throw mapped;
      }
    }

    try {
      await client.put(Buffer.from(content, encoding), remotePath);
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const client = this.requireClient();

    try {
      await client.rename(oldPath, newPath);
    } catch (error) {
      throw this.mapError(error, undefined, oldPath);
    }
  }

  async delete(remotePath: string): Promise<void> {
    const client = this.requireClient();

    try {
      await client.delete(remotePath);
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  async mkdir(remotePath: string): Promise<void> {
    const client = this.requireClient();

    try {
      await client.mkdir(remotePath, true);
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  async stat(remotePath: string): Promise<FileEntry> {
    const client = this.requireClient();

    try {
      const fileStat = await client.stat(remotePath);
      return this.mapStatEntry(remotePath, fileStat);
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  async fastPut(localPath: string, remotePath: string, opts?: TransferOptions): Promise<void> {
    const client = this.requireClient();
    const extensions = this.parseExtensions(opts?.extensions);

    try {
      await client.fastPut(localPath, remotePath, this.buildFastPutOptions(opts, extensions));
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  async fastGet(remotePath: string, localPath: string, opts?: TransferOptions): Promise<void> {
    const client = this.requireClient();
    const extensions = this.parseExtensions(opts?.extensions);

    try {
      await client.fastGet(remotePath, localPath, this.buildFastGetOptions(opts, extensions));
    } catch (error) {
      throw this.mapError(error, undefined, remotePath);
    }
  }

  private createClient(name: string): SftpClient {
    return new SftpClient(name, {
      error: (error) => logger.error({ error }, "SFTP client emitted error"),
      close: () => logger.info("SFTP client closed"),
      end: () => logger.info("SFTP client ended"),
    });
  }

  private requireClient(): SftpClient {
    if (!this.client) {
      throw connectionNotFound("sftp-active");
    }
    return this.client;
  }

  private buildConnectOptions(
    config: ConnectionConfig,
    extensions: SftpAdapterExtensions,
    strictHostKey: boolean,
  ): SftpConnectOptions {
    const connectOptions: SftpConnectOptions = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: extensions.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS,
      timeout: extensions.timeoutMs ?? DEFAULT_SOCKET_TIMEOUT_MS,
      retries: extensions.retries ?? DEFAULT_RETRIES,
      retry_factor: extensions.retryFactor ?? DEFAULT_RETRY_FACTOR,
      retry_minTimeout: extensions.retryMinTimeoutMs ?? DEFAULT_RETRY_MIN_TIMEOUT_MS,
    };

    if (extensions.privateKey !== undefined) {
      connectOptions.privateKey = extensions.privateKey;
      if (extensions.passphrase) {
        connectOptions.passphrase = extensions.passphrase;
      }
    } else {
      connectOptions.password = config.password;
    }

    if (strictHostKey) {
      const fingerprint = extensions.hostFingerprint?.trim();
      if (!fingerprint) {
        throw hostKeyMismatch(config.host);
      }

      connectOptions.hostHash = extensions.hostHash ?? "sha256";
      connectOptions.hostVerifier = (serverFingerprint: string) =>
        this.matchHostFingerprint(serverFingerprint, fingerprint);
    } else {
      logger.warn(
        {
          host: config.host,
          port: config.port,
          username: config.username,
        },
        "SFTP host key strict validation disabled by extension strictHostKey=false",
      );

      connectOptions.hostVerifier = () => true;
    }

    return connectOptions;
  }

  private buildPutOptions(opts?: TransferOptions): SftpPutOptions | undefined {
    if (!opts?.onProgress) {
      return undefined;
    }

    return {
      writeStreamOptions: {
        autoClose: true,
      },
    };
  }

  private buildFastPutOptions(
    opts: TransferOptions | undefined,
    extensions: SftpAdapterExtensions,
  ): SftpFastPutOptions | undefined {
    if (!opts?.onProgress && !extensions.fastConcurrency && !extensions.fastChunkSize) {
      return undefined;
    }

    return {
      concurrency: extensions.fastConcurrency,
      chunkSize: extensions.fastChunkSize,
      step: (transferred, _chunk, total) => {
        opts?.onProgress?.(transferred, total);
      },
    };
  }

  private buildFastGetOptions(
    opts: TransferOptions | undefined,
    extensions: SftpAdapterExtensions,
  ): SftpFastGetOptions | undefined {
    if (!opts?.onProgress && !extensions.fastConcurrency && !extensions.fastChunkSize) {
      return undefined;
    }

    return {
      concurrency: extensions.fastConcurrency,
      chunkSize: extensions.fastChunkSize,
      step: (transferred, _chunk, total) => {
        opts?.onProgress?.(transferred, total);
      },
    };
  }

  private mapListEntry(basePath: string, entry: SftpListEntry): FileEntry {
    return {
      name: entry.name,
      path: this.resolveChildPath(basePath, entry.name),
      type: this.mapTypeFromFileInfo(entry.type),
      size: Number.isFinite(entry.size) ? entry.size : null,
      modifiedAt: this.toIsoTimestamp(entry.modifyTime),
      permissions: this.rightsToPermissions(entry.rights),
    };
  }

  private mapStatEntry(remotePath: string, stat: SftpFileStat): FileEntry {
    return {
      name: posixPath.basename(remotePath),
      path: remotePath,
      type: this.mapTypeFromStat(stat),
      size: Number.isFinite(stat.size) ? stat.size : null,
      modifiedAt: this.toIsoTimestamp(stat.modifyTime),
      permissions: this.modeToPermissions(stat.mode),
    };
  }

  private mapTypeFromFileInfo(type: string): FileType {
    if (type === "d") {
      return "directory";
    }
    if (type === "-") {
      return "file";
    }
    if (type === "l") {
      return "symlink";
    }
    return "unknown";
  }

  private mapTypeFromStat(stat: SftpFileStat): FileType {
    if (stat.isDirectory) {
      return "directory";
    }
    if (stat.isSymbolicLink) {
      return "symlink";
    }
    if (stat.isFile) {
      return "file";
    }
    return "unknown";
  }

  private resolveChildPath(basePath: string, childName: string): string {
    if (basePath === "/") {
      return `/${childName}`;
    }

    return `${basePath.replace(/\/+$/, "")}/${childName}`;
  }

  private toIsoTimestamp(rawTimestamp: number): string | null {
    if (!Number.isFinite(rawTimestamp) || rawTimestamp <= 0) {
      return null;
    }

    const asMilliseconds = rawTimestamp > 9_999_999_999 ? rawTimestamp : rawTimestamp * 1000;
    return new Date(asMilliseconds).toISOString();
  }

  private rightsToPermissions(
    rights: { user: string; group: string; other: string } | undefined,
  ): string | undefined {
    if (!rights) {
      return undefined;
    }

    return [rights.user, rights.group, rights.other]
      .map((segment) => this.normalizePermissionSegment(segment))
      .join("");
  }

  private normalizePermissionSegment(segment: string): string {
    const source = segment.toLowerCase();
    return `${source.includes("r") ? "r" : "-"}${source.includes("w") ? "w" : "-"}${source.includes("x") ? "x" : "-"}`;
  }

  private modeToPermissions(mode: number): string | undefined {
    if (!Number.isFinite(mode)) {
      return undefined;
    }

    const toTriplet = (bitset: number): string => {
      return `${bitset & 0b100 ? "r" : "-"}${bitset & 0b010 ? "w" : "-"}${bitset & 0b001 ? "x" : "-"}`;
    };

    const user = (mode >> 6) & 0b111;
    const group = (mode >> 3) & 0b111;
    const other = mode & 0b111;

    return `${toTriplet(user)}${toTriplet(group)}${toTriplet(other)}`;
  }

  private buildEtag(modifiedAt: string | null, size: number | null): string | null {
    if (!modifiedAt || size === null) {
      return null;
    }

    return createHash("md5").update(`${modifiedAt}:${size}`).digest("hex");
  }

  private matchHostFingerprint(actual: string, expected: string): boolean {
    const normalizedActual = this.normalizeFingerprint(actual);
    const normalizedExpected = this.normalizeFingerprint(expected);

    if (normalizedActual.length === 0 || normalizedExpected.length === 0) {
      return false;
    }

    const actualBuffer = Buffer.from(normalizedActual, "utf-8");
    const expectedBuffer = Buffer.from(normalizedExpected, "utf-8");

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  }

  private normalizeFingerprint(value: string): string {
    return value.trim().replace(/^sha256:/i, "").replace(/:/g, "").toLowerCase();
  }

  private parseExtensions(extensions: ProtocolExtensions | undefined): SftpAdapterExtensions {
    const source = (extensions ?? {}) as Record<string, unknown>;

    return {
      privateKey:
        typeof source.privateKey === "string" || Buffer.isBuffer(source.privateKey)
          ? source.privateKey
          : undefined,
      passphrase: typeof source.passphrase === "string" ? source.passphrase : undefined,
      strictHostKey: typeof source.strictHostKey === "boolean" ? source.strictHostKey : undefined,
      hostFingerprint:
        typeof source.hostFingerprint === "string" ? source.hostFingerprint : undefined,
      hostHash: typeof source.hostHash === "string" ? source.hostHash : undefined,
      readyTimeoutMs: this.toSafeInteger(source.readyTimeoutMs),
      timeoutMs: this.toSafeInteger(source.timeoutMs),
      retries: this.toSafeInteger(source.retries),
      retryFactor: this.toSafeInteger(source.retryFactor),
      retryMinTimeoutMs: this.toSafeInteger(source.retryMinTimeoutMs),
      useFastPut: source.useFastPut === true,
      useFastGet: source.useFastGet === true,
      fastConcurrency: this.toSafeInteger(source.fastConcurrency),
      fastChunkSize: this.toSafeInteger(source.fastChunkSize),
    };
  }

  private toSafeInteger(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }
    return Math.trunc(value);
  }

  private mapError(error: unknown, host?: string, path?: string): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const message = this.extractErrorMessage(error);
    const normalized = message.toLowerCase();

    if (
      normalized.includes("all configured authentication methods failed") ||
      normalized.includes("authentication failed") ||
      normalized.includes("permission denied")
    ) {
      return authFailed(host ?? "unknown");
    }

    if (
      normalized.includes("host key") ||
      normalized.includes("key mismatch") ||
      normalized.includes("fingerprint")
    ) {
      return hostKeyMismatch(host ?? "unknown");
    }

    if (normalized.includes("timed out") || normalized.includes("etimedout")) {
      return new AppError({
        code: ErrorCode.CONNECTION_TIMEOUT,
        message: `SFTP connection timed out${host ? ` for host ${host}` : ""}`,
        details: { cause: message, host },
      });
    }

    if (
      normalized.includes("no such file") ||
      normalized.includes("no such path") ||
      normalized.includes("failure")
    ) {
      return invalidPath(path ?? "unknown");
    }

    if (normalized.includes("not connected")) {
      return connectionNotFound("sftp-active");
    }

    return new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message: `SFTP operation failed: ${message}`,
      details: {
        cause: message,
        host,
        path,
      },
    });
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return "Unknown SFTP error";
  }

  private async safeEnd(client: SftpClient): Promise<void> {
    try {
      await client.end();
    } catch {}
  }
}
