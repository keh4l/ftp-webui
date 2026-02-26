import pino from "pino";

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
] as const;

const shouldUsePrettyTransport =
  process.env.NODE_ENV !== "production" &&
  process.env.NODE_ENV !== "test" &&
  process.env.PLAYWRIGHT_TEST !== "1";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [...redactionPaths],
    censor: "[REDACTED]",
  },
  ...(shouldUsePrettyTransport
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

export function maskCipherPreview(value: string): string {
  if (value.length <= 8) {
    return `${value}...`;
  }

  return `${value.slice(0, 8)}...`;
}
