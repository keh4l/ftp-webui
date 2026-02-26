import type { Connection, ConnectionProtocol } from "./model";
import type { ConnectionRepository } from "./repository";
import { encrypt, decrypt } from "@/lib/crypto";
import { connectionNotFound, validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { FtpAdapter } from "@/lib/protocol/ftp-adapter";
import { SftpAdapter } from "@/lib/protocol/sftp-adapter";
import type {
  ConnectionConfig,
  ProtocolAdapter,
  TestResult,
} from "@/lib/protocol/types";
import { assertHostAllowed, auditLog } from "@/lib/security";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ConnectionInput = {
  protocol: ConnectionProtocol;
  host: string;
  port: number;
  username: string;
  password: string;
  label?: string | null;
};

export type ConnectionView = {
  id: string;
  protocol: ConnectionProtocol;
  host: string;
  port: number;
  username: string;
  maskedSecret: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Extended repository contract (adds findById / update / remove)
// ---------------------------------------------------------------------------

type UpdateConnectionData = {
  protocol?: ConnectionProtocol;
  host?: string;
  port?: number;
  username?: string;
  encryptedSecret?: string;
  label?: string | null;
};

export type ConnectionServiceRepository = ConnectionRepository & {
  findById(id: string): Connection | null;
  update(id: string, data: UpdateConnectionData): Connection;
  remove(id: string): boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toView(c: Connection): ConnectionView {
  return {
    id: c.id,
    protocol: c.protocol,
    host: c.host,
    port: c.port,
    username: c.username,
    maskedSecret: "****",
    label: c.label,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function createAdapter(protocol: ConnectionProtocol): ProtocolAdapter {
  if (protocol === "ftp" || protocol === "ftps") return new FtpAdapter();
  if (protocol === "sftp") return new SftpAdapter();
  throw validationError({ protocol, message: `Unsupported protocol: ${protocol}` });
}

function toConfig(input: ConnectionInput): ConnectionConfig {
  return {
    protocol: input.protocol,
    host: input.host,
    port: input.port,
    username: input.username,
    password: input.password,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ConnectionService {
  constructor(private readonly repository: ConnectionServiceRepository) {}

  async createConnection(input: ConnectionInput): Promise<ConnectionView> {
    await assertHostAllowed(input.host);

    const encryptedSecret = encrypt(input.password);
    const connection = this.repository.create({
      protocol: input.protocol,
      host: input.host,
      port: input.port,
      username: input.username,
      encryptedSecret,
      label: input.label,
    });
    logger.info(
      { id: connection.id, host: input.host, protocol: input.protocol },
      "Connection created",
    );
    auditLog({
      action: "connection.create",
      target: { id: connection.id, host: input.host, protocol: input.protocol },
      result: "success",
    });
    return toView(connection);
  }

  listConnections(): ConnectionView[] {
    return this.repository.list().map(toView);
  }

  getConnection(id: string): ConnectionView {
    const connection = this.repository.findById(id);
    if (!connection) throw connectionNotFound(id);
    return toView(connection);
  }

  async updateConnection(id: string, input: Partial<ConnectionInput>): Promise<ConnectionView> {
    const existing = this.repository.findById(id);
    if (!existing) throw connectionNotFound(id);

    // SSRF check if host is being changed
    const newHost = input.host ?? existing.host;
    if (input.host !== undefined) {
      await assertHostAllowed(newHost);
    }

    const data: UpdateConnectionData = {};
    if (input.protocol !== undefined) data.protocol = input.protocol;
    if (input.host !== undefined) data.host = input.host;
    if (input.port !== undefined) data.port = input.port;
    if (input.username !== undefined) data.username = input.username;
    if (input.password !== undefined) data.encryptedSecret = encrypt(input.password);
    if (input.label !== undefined) data.label = input.label;

    const updated = this.repository.update(id, data);
    auditLog({
      action: "connection.update",
      target: { id, host: newHost, protocol: updated.protocol },
      result: "success",
    });
    return toView(updated);
  }

  deleteConnection(id: string): void {
    const existing = this.repository.findById(id);
    if (!existing) throw connectionNotFound(id);
    this.repository.remove(id);
    logger.info(
      { id, host: existing.host, protocol: existing.protocol },
      "Connection deleted",
    );
    auditLog({
      action: "connection.delete",
      target: { id, host: existing.host, protocol: existing.protocol },
      result: "success",
    });
  }

  async testConnection(id: string): Promise<TestResult> {
    const connection = this.repository.findById(id);
    if (!connection) throw connectionNotFound(id);

    const password = decrypt(connection.encryptedSecret);
    const config: ConnectionConfig = {
      protocol: connection.protocol,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password,
    };

    const adapter = createAdapter(connection.protocol);
    const result = await adapter.testConnection(config);
    logger.info(
      { id, host: connection.host, protocol: connection.protocol, success: result.success },
      "Connection tested",
    );
    auditLog({
      action: "connection.test",
      target: { id, host: connection.host, protocol: connection.protocol },
      result: result.success ? "success" : "failure",
      error: result.success ? undefined : result.error?.message,
    });
    return result;
  }

  async testConnectionDirect(input: ConnectionInput): Promise<TestResult> {
    await assertHostAllowed(input.host);

    const adapter = createAdapter(input.protocol);
    const result = await adapter.testConnection(toConfig(input));
    logger.info(
      { host: input.host, protocol: input.protocol, success: result.success },
      "Direct connection tested",
    );
    auditLog({
      action: "connection.test",
      target: { host: input.host, protocol: input.protocol },
      result: result.success ? "success" : "failure",
      error: result.success ? undefined : result.error?.message,
    });
    return result;
  }
}
