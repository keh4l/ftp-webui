import type { Readable } from "node:stream";

import type {
  ConnectionConfig,
  FileEntry,
  ProtocolAdapter,
  ReadTextOptions,
  TestResult,
  TextContent,
  TransferOptions,
  WriteTextOptions,
} from "@/lib/protocol/types";

export class FtpAdapterStub implements ProtocolAdapter {
  async connect(_config: ConnectionConfig): Promise<void> {
    throw new Error("not implemented");
  }

  async disconnect(): Promise<void> {
    throw new Error("not implemented");
  }

  async testConnection(_config: ConnectionConfig): Promise<TestResult> {
    throw new Error("not implemented");
  }

  async list(_remotePath: string): Promise<FileEntry[]> {
    throw new Error("not implemented");
  }

  async upload(
    _localPath: string | Buffer | Readable,
    _remotePath: string,
    _opts?: TransferOptions,
  ): Promise<void> {
    throw new Error("not implemented");
  }

  async download(_remotePath: string): Promise<Readable> {
    throw new Error("not implemented");
  }

  async readText(
    _remotePath: string,
    _opts?: ReadTextOptions,
  ): Promise<TextContent> {
    throw new Error("not implemented");
  }

  async writeText(
    _remotePath: string,
    _content: string,
    _opts?: WriteTextOptions,
  ): Promise<void> {
    throw new Error("not implemented");
  }

  async rename(_oldPath: string, _newPath: string): Promise<void> {
    throw new Error("not implemented");
  }

  async delete(_remotePath: string): Promise<void> {
    throw new Error("not implemented");
  }

  async mkdir(_remotePath: string): Promise<void> {
    throw new Error("not implemented");
  }

  async stat(_remotePath: string): Promise<FileEntry> {
    throw new Error("not implemented");
  }
}

export class SftpAdapterStub implements ProtocolAdapter {
  async connect(_config: ConnectionConfig): Promise<void> {
    throw new Error("not implemented");
  }

  async disconnect(): Promise<void> {
    throw new Error("not implemented");
  }

  async testConnection(_config: ConnectionConfig): Promise<TestResult> {
    throw new Error("not implemented");
  }

  async list(_remotePath: string): Promise<FileEntry[]> {
    throw new Error("not implemented");
  }

  async upload(
    _localPath: string | Buffer | Readable,
    _remotePath: string,
    _opts?: TransferOptions,
  ): Promise<void> {
    throw new Error("not implemented");
  }

  async download(_remotePath: string): Promise<Readable> {
    throw new Error("not implemented");
  }

  async readText(
    _remotePath: string,
    _opts?: ReadTextOptions,
  ): Promise<TextContent> {
    throw new Error("not implemented");
  }

  async writeText(
    _remotePath: string,
    _content: string,
    _opts?: WriteTextOptions,
  ): Promise<void> {
    throw new Error("not implemented");
  }

  async rename(_oldPath: string, _newPath: string): Promise<void> {
    throw new Error("not implemented");
  }

  async delete(_remotePath: string): Promise<void> {
    throw new Error("not implemented");
  }

  async mkdir(_remotePath: string): Promise<void> {
    throw new Error("not implemented");
  }

  async stat(_remotePath: string): Promise<FileEntry> {
    throw new Error("not implemented");
  }
}
