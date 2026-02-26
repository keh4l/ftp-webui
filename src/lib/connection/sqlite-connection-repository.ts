import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { createSqliteDatabase, type SqliteOptions } from "../db/sqlite";
import {
  ConnectionProtocol,
  type Connection,
  type ConnectionProtocol as ConnectionProtocolType,
  type CreateConnectionInput,
} from "./model";
import type { ConnectionRepository } from "./repository";

type ConnectionRow = {
  id: string;
  protocol: string;
  host: string;
  port: number;
  username: string;
  encrypted_secret: string;
  label: string | null;
  created_at: string;
  updated_at: string;
};

type SqliteRepositoryOptions = SqliteOptions & {
  database?: Database.Database;
};

function isConnectionProtocol(value: string): value is ConnectionProtocolType {
  return Object.values(ConnectionProtocol).includes(value as ConnectionProtocolType);
}

function toConnection(row: ConnectionRow): Connection {
  if (!isConnectionProtocol(row.protocol)) {
    throw new Error(`Unsupported connection protocol in storage: ${row.protocol}`);
  }

  return {
    id: row.id,
    protocol: row.protocol,
    host: row.host,
    port: row.port,
    username: row.username,
    encryptedSecret: row.encrypted_secret,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteConnectionRepository implements ConnectionRepository {
  private readonly database: Database.Database;

  constructor(options: SqliteRepositoryOptions = {}) {
    this.database = options.database ?? createSqliteDatabase(options);
  }

  init() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        protocol TEXT NOT NULL CHECK (protocol IN ('ftp', 'ftps', 'sftp')),
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT NOT NULL,
        encrypted_secret TEXT NOT NULL,
        label TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_connections_updated_at
      ON connections(updated_at DESC);
    `);
  }

  create(input: CreateConnectionInput) {
    const now = new Date().toISOString();
    const id = randomUUID();

    const statement = this.database.prepare(`
      INSERT INTO connections (
        id,
        protocol,
        host,
        port,
        username,
        encrypted_secret,
        label,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    statement.run(
      id,
      input.protocol,
      input.host,
      input.port,
      input.username,
      input.encryptedSecret,
      input.label ?? null,
      now,
      now
    );

    return {
      id,
      protocol: input.protocol,
      host: input.host,
      port: input.port,
      username: input.username,
      encryptedSecret: input.encryptedSecret,
      label: input.label ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  list() {
    const statement = this.database.prepare(`
      SELECT
        id,
        protocol,
        host,
        port,
        username,
        encrypted_secret,
        label,
        created_at,
        updated_at
      FROM connections
      ORDER BY updated_at DESC
    `);

    const rows = statement.all() as ConnectionRow[];
    return rows.map(toConnection);
  }

  findById(id: string): Connection | null {
    const row = this.database
      .prepare(
        `SELECT id, protocol, host, port, username, encrypted_secret, label, created_at, updated_at
         FROM connections WHERE id = ?`
      )
      .get(id) as ConnectionRow | undefined;
    return row ? toConnection(row) : null;
  }

  update(
    id: string,
    data: {
      protocol?: ConnectionProtocolType;
      host?: string;
      port?: number;
      username?: string;
      encryptedSecret?: string;
      label?: string | null;
    },
  ): Connection {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    if (data.protocol !== undefined) { setClauses.push("protocol = ?"); params.push(data.protocol); }
    if (data.host !== undefined) { setClauses.push("host = ?"); params.push(data.host); }
    if (data.port !== undefined) { setClauses.push("port = ?"); params.push(data.port); }
    if (data.username !== undefined) { setClauses.push("username = ?"); params.push(data.username); }
    if (data.encryptedSecret !== undefined) { setClauses.push("encrypted_secret = ?"); params.push(data.encryptedSecret); }
    if (data.label !== undefined) { setClauses.push("label = ?"); params.push(data.label); }
    const now = new Date().toISOString();
    setClauses.push("updated_at = ?");
    params.push(now);
    params.push(id);
    this.database
      .prepare(`UPDATE connections SET ${setClauses.join(", ")} WHERE id = ?`)
      .run(...params);
    return this.findById(id)!;
  }

  remove(id: string): boolean {
    const result = this.database
      .prepare("DELETE FROM connections WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }
}
