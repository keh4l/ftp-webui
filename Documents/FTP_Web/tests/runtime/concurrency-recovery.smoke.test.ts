import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { ErrorCode } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { ConnectionPool } from "@/lib/protocol/pool";
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
import { ResilienceMetrics, withRetry } from "@/lib/protocol/retry";

class FakeAdapter implements ProtocolAdapter {
  async connect(_config: ConnectionConfig): Promise<void> {}
  async disconnect(): Promise<void> {}
  async testConnection(_config: ConnectionConfig): Promise<TestResult> {
    return { success: true, latencyMs: 1 };
  }
  async list(_remotePath: string): Promise<FileEntry[]> {
    return [];
  }
  async upload(_localPath: string | Buffer | Readable, _remotePath: string, _opts?: TransferOptions): Promise<void> {}
  async download(_remotePath: string): Promise<Readable> {
    return Readable.from([]);
  }
  async readText(_remotePath: string, _opts?: ReadTextOptions): Promise<TextContent> {
    return { content: "", etag: null, encoding: "utf8" };
  }
  async writeText(_remotePath: string, _content: string, _opts?: WriteTextOptions): Promise<void> {}
  async rename(_oldPath: string, _newPath: string): Promise<void> {}
  async delete(_remotePath: string): Promise<void> {}
  async mkdir(_remotePath: string): Promise<void> {}
  async stat(_remotePath: string): Promise<FileEntry> {
    return {
      name: "",
      path: "/",
      type: "file",
      size: 0,
      modifiedAt: null,
      permissions: undefined,
    };
  }
}

function timeoutError(message: string): AppError {
  return new AppError({
    code: ErrorCode.CONNECTION_TIMEOUT,
    message,
  });
}

async function ensureEvidenceDir(): Promise<string> {
  const evidenceDir = path.join(process.cwd(), ".sisyphus", "evidence");
  await mkdir(evidenceDir, { recursive: true });
  return evidenceDir;
}

describe("T23 并发与恢复烟测", () => {
  it("20连接混合操作并输出并发报告", async () => {
    const pool = new ConnectionPool({
      maxConnections: 20,
      acquireTimeoutMs: 800,
      idleTimeoutMs: 2_000,
      cleanupIntervalMs: 1_000,
    });
    const metrics = new ResilienceMetrics();

    const totalOperations = 200;
    const latencies: number[] = [];
    let successCount = 0;
    let failCount = 0;

    await Promise.all(
      Array.from({ length: totalOperations }, async (_, index) => {
        const connectionId = `conn-${index % 20}`;
        const startedAt = Date.now();
        const adapter = await pool.acquire(connectionId, () => new FakeAdapter());

        try {
          let attempts = 0;
          await withRetry(
            async () => {
              attempts += 1;
              if (index % 10 === 0 && attempts === 1) {
                throw timeoutError("simulated transient timeout");
              }
              await new Promise((resolve) => setTimeout(resolve, 5));
            },
            {
              maxAttempts: 3,
              baseDelayMs: 10,
              maxDelayMs: 30,
              metrics,
              operationName: "concurrency-smoke-op",
            },
          );
          successCount += 1;
        } catch {
          failCount += 1;
        } finally {
          pool.release(connectionId);
          latencies.push(Date.now() - startedAt);
          void adapter;
        }
      }),
    );

    const sortedLatency = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(sortedLatency.length * 0.95) - 1);
    const p95 = sortedLatency[p95Index] ?? 0;
    const successRate = successCount / totalOperations;

    const evidenceDir = await ensureEvidenceDir();
    const report = [
      `total_operations=${totalOperations}`,
      `success_count=${successCount}`,
      `fail_count=${failCount}`,
      `success_rate=${(successRate * 100).toFixed(2)}%`,
      `p95_latency_ms=${p95}`,
      `retry_metrics=${JSON.stringify(metrics.snapshot())}`,
      `pool_metrics=${JSON.stringify(pool.getStats())}`,
    ].join("\n");
    await writeFile(path.join(evidenceDir, "task-23-concurrency-report.txt"), report, "utf8");

    await pool.destroyAll();
    expect(successRate).toBeGreaterThanOrEqual(0.98);
  });

  it("故障注入后恢复并输出恢复报告", async () => {
    const pool = new ConnectionPool({
      maxConnections: 20,
      acquireTimeoutMs: 1_500,
      idleTimeoutMs: 2_000,
      cleanupIntervalMs: 1_000,
    });
    const metrics = new ResilienceMetrics();

    const totalOperations = 80;
    const outageDurationMs = 220;
    const outageStart = Date.now();
    let successCount = 0;
    let failCount = 0;

    await Promise.all(
      Array.from({ length: totalOperations }, async (_, index) => {
        const connectionId = `recover-${index % 20}`;
        await pool.acquire(connectionId, () => new FakeAdapter());

        try {
          await withRetry(
            async () => {
              const inOutageWindow = Date.now() - outageStart < outageDurationMs;
              if (inOutageWindow) {
                throw timeoutError("simulated outage");
              }
              await new Promise((resolve) => setTimeout(resolve, 3));
            },
            {
              maxAttempts: 6,
              baseDelayMs: 25,
              maxDelayMs: 80,
              metrics,
              operationName: "recovery-smoke-op",
            },
          );
          successCount += 1;
        } catch {
          failCount += 1;
        } finally {
          pool.release(connectionId);
        }
      }),
    );

    const successRate = successCount / totalOperations;
    const evidenceDir = await ensureEvidenceDir();
    const report = [
      `total_operations=${totalOperations}`,
      `outage_duration_ms=${outageDurationMs}`,
      `success_count=${successCount}`,
      `fail_count=${failCount}`,
      `success_rate=${(successRate * 100).toFixed(2)}%`,
      `retry_metrics=${JSON.stringify(metrics.snapshot())}`,
      `pool_metrics=${JSON.stringify(pool.getStats())}`,
    ].join("\n");
    await writeFile(path.join(evidenceDir, "task-23-recovery-report.txt"), report, "utf8");

    await pool.destroyAll();
    expect(successRate).toBeGreaterThanOrEqual(0.98);
  });
});
