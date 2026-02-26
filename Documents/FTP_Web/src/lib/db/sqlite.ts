import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_DB_PATH = path.join(process.cwd(), ".data", "ftp-webui.sqlite");

export type SqliteOptions = {
  filePath?: string;
};

export function createSqliteDatabase(options: SqliteOptions = {}) {
  const filePath = options.filePath ?? DEFAULT_DB_PATH;
  const directory = path.dirname(filePath);
  mkdirSync(directory, { recursive: true });
  return new Database(filePath);
}

export function resolveDefaultDbPath() {
  return DEFAULT_DB_PATH;
}
