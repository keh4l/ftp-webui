import type { Readable } from "node:stream";

import type { Connection } from "@/lib/connection/model";
import type { ErrorCode } from "@/lib/constants";

export type ProtocolExtensions = Record<string, unknown>;

export type ConnectionConfig = Pick<
  Connection,
  "protocol" | "host" | "port" | "username"
> & {
  password: string;
  extensions?: ProtocolExtensions;
};

export type FileType = "file" | "directory" | "symlink" | "unknown";

export type FileEntry = {
  name: string;
  path: string;
  type: FileType;
  size: number | null;
  modifiedAt: string | null;
  permissions?: string;
  extensions?: ProtocolExtensions;
};

export type TransferOptions = {
  onProgress?: (transferred: number, total?: number) => void;
  extensions?: ProtocolExtensions;
};

export type ReadTextOptions = {
  maxSize?: number;
  extensions?: ProtocolExtensions;
};

export type WriteTextOptions = {
  etag?: string;
  encoding?: string;
  extensions?: ProtocolExtensions;
};

export type ProtocolError = {
  message: string;
  code?: ErrorCode;
  details?: unknown;
};

export type TestResult = {
  success: boolean;
  latencyMs: number;
  error?: ProtocolError;
  serverBanner?: string;
  extensions?: ProtocolExtensions;
};

export type TextContent = {
  content: string;
  etag: string | null;
  encoding: string;
  extensions?: ProtocolExtensions;
};

export interface ProtocolAdapter {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(config: ConnectionConfig): Promise<TestResult>;
  list(remotePath: string): Promise<FileEntry[]>;
  upload(
    localPath: string | Buffer | Readable,
    remotePath: string,
    opts?: TransferOptions,
  ): Promise<void>;
  download(remotePath: string): Promise<Readable>;
  readText(remotePath: string, opts?: ReadTextOptions): Promise<TextContent>;
  writeText(
    remotePath: string,
    content: string,
    opts?: WriteTextOptions,
  ): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  delete(remotePath: string): Promise<void>;
  mkdir(remotePath: string): Promise<void>;
  stat(remotePath: string): Promise<FileEntry>;
}
