"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteConnectionRepository = void 0;
const node_crypto_1 = require("node:crypto");
const sqlite_1 = require("../db/sqlite");
const model_1 = require("./model");
function isConnectionProtocol(value) {
    return Object.values(model_1.ConnectionProtocol).includes(value);
}
function toConnection(row) {
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
class SqliteConnectionRepository {
    constructor(options = {}) {
        this.database = options.database ?? (0, sqlite_1.createSqliteDatabase)(options);
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
    create(input) {
        const now = new Date().toISOString();
        const id = (0, node_crypto_1.randomUUID)();
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
        statement.run(id, input.protocol, input.host, input.port, input.username, input.encryptedSecret, input.label ?? null, now, now);
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
        const rows = statement.all();
        return rows.map(toConnection);
    }
}
exports.SqliteConnectionRepository = SqliteConnectionRepository;
