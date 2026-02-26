"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.maskCipherPreview = maskCipherPreview;
const pino_1 = __importDefault(require("pino"));
const redactionPaths = [
    "password",
    "secret",
    "privateKey",
    "token",
    "encryptedSecret",
    "authorization",
    "*.password",
    "*.secret",
    "*.privateKey",
    "*.token",
    "*.encryptedSecret",
    "*.authorization",
];
const isDevelopment = process.env.NODE_ENV !== "production";
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
        paths: [...redactionPaths],
        censor: "[REDACTED]",
    },
    ...(isDevelopment
        ? {
            transport: {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                },
            },
        }
        : {}),
});
function maskCipherPreview(value) {
    if (value.length <= 8) {
        return `${value}...`;
    }
    return `${value.slice(0, 8)}...`;
}
