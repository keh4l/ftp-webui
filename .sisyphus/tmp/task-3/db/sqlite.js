"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSqliteDatabase = createSqliteDatabase;
exports.resolveDefaultDbPath = resolveDefaultDbPath;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const DEFAULT_DB_PATH = node_path_1.default.join(process.cwd(), ".data", "ftp-webui.sqlite");
function createSqliteDatabase(options = {}) {
    const filePath = options.filePath ?? DEFAULT_DB_PATH;
    const directory = node_path_1.default.dirname(filePath);
    (0, node_fs_1.mkdirSync)(directory, { recursive: true });
    return new better_sqlite3_1.default(filePath);
}
function resolveDefaultDbPath() {
    return DEFAULT_DB_PATH;
}
