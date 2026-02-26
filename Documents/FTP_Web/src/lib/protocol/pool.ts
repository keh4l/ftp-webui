import { ErrorCode } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ProtocolAdapter } from "@/lib/protocol/types";

export type PoolState = "idle" | "busy";

export type PoolEntry = {
  adapter: ProtocolAdapter;
  lastUsed: number;
  state: PoolState;
};

export type AdapterFactory = () => Promise<ProtocolAdapter> | ProtocolAdapter;

export type ConnectionPoolConfig = {
  maxConnections?: number;
  idleTimeoutMs?: number;
  acquireTimeoutMs?: number;
  cleanupIntervalMs?: number;
};

export type ConnectionPoolMetrics = {
  acquireRequests: number;
  acquireWaits: number;
  acquireTimeouts: number;
  created: number;
  reused: number;
  released: number;
  destroyed: number;
  idleEvictions: number;
};

export type ConnectionPoolStats = {
  active: number;
  idle: number;
  total: number;
  waiting: number;
  maxConnections: number;
  metrics: ConnectionPoolMetrics;
};

type AcquireWaiter = {
  connectionId: string;
  factory: AdapterFactory;
  resolve: (adapter: ProtocolAdapter) => void;
  reject: (error: unknown) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
};

const DEFAULT_MAX_CONNECTIONS = 20;
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 10_000;
const MIN_CLEANUP_INTERVAL_MS = 1_000;

export class ConnectionPool {
  private readonly config: Required<ConnectionPoolConfig>;

  private readonly entries = new Map<string, PoolEntry>();
  private readonly waiters: AcquireWaiter[] = [];
  private readonly pendingCreates = new Set<string>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  private isDraining = false;

  private readonly metrics: ConnectionPoolMetrics = {
    acquireRequests: 0,
    acquireWaits: 0,
    acquireTimeouts: 0,
    created: 0,
    reused: 0,
    released: 0,
    destroyed: 0,
    idleEvictions: 0,
  };

  constructor(config: ConnectionPoolConfig = {}) {
    const idleTimeoutMs = config.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    const cleanupIntervalMs =
      config.cleanupIntervalMs ?? Math.max(MIN_CLEANUP_INTERVAL_MS, Math.floor(idleTimeoutMs / 2));

    this.config = {
      maxConnections: config.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
      idleTimeoutMs,
      acquireTimeoutMs: config.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS,
      cleanupIntervalMs,
    };

    this.cleanupTimer = setInterval(() => {
      void this.pruneIdleEntries();
    }, this.config.cleanupIntervalMs);

    this.cleanupTimer.unref?.();
  }

  async acquire(connectionId: string, factory: AdapterFactory): Promise<ProtocolAdapter> {
    this.metrics.acquireRequests += 1;

    const existingEntry = this.entries.get(connectionId);
    if (existingEntry?.state === "idle") {
      existingEntry.state = "busy";
      existingEntry.lastUsed = Date.now();
      this.metrics.reused += 1;
      return existingEntry.adapter;
    }

    if (
      existingEntry?.state === "busy" ||
      this.pendingCreates.has(connectionId) ||
      this.isAtCapacity()
    ) {
      this.metrics.acquireWaits += 1;
      return this.waitForAdapter(connectionId, factory);
    }

    return this.createEntry(connectionId, factory);
  }

  release(connectionId: string): void {
    const entry = this.entries.get(connectionId);
    if (!entry) {
      return;
    }

    if (entry.state === "busy") {
      entry.state = "idle";
      entry.lastUsed = Date.now();
      this.metrics.released += 1;
      void this.drainWaiters();
      return;
    }

    entry.lastUsed = Date.now();
  }

  async destroy(connectionId: string): Promise<void> {
    const entry = this.entries.get(connectionId);
    if (!entry) {
      return;
    }

    this.entries.delete(connectionId);
    this.metrics.destroyed += 1;

    try {
      await entry.adapter.disconnect();
    } catch (error) {
      logger.warn(
        {
          connectionId,
          error: toLogError(error),
        },
        "Failed to disconnect adapter while destroying pool entry",
      );
    } finally {
      void this.drainWaiters();
    }
  }

  async destroyAll(): Promise<void> {
    this.waiters.splice(0, this.waiters.length).forEach((waiter) => {
      clearTimeout(waiter.timeoutHandle);
      waiter.reject(
        new AppError({
          code: ErrorCode.CONNECTION_TIMEOUT,
          message: "Connection pool was cleared while waiting for adapter",
        }),
      );
    });

    const snapshots = [...this.entries.entries()];
    this.entries.clear();

    await Promise.all(
      snapshots.map(async ([connectionId, entry]) => {
        this.metrics.destroyed += 1;
        try {
          await entry.adapter.disconnect();
        } catch (error) {
          logger.warn(
            {
              connectionId,
              error: toLogError(error),
            },
            "Failed to disconnect adapter while destroying entire pool",
          );
        }
      }),
    );
  }

  getStats(): ConnectionPoolStats {
    let active = 0;
    let idle = 0;

    this.entries.forEach((entry) => {
      if (entry.state === "busy") {
        active += 1;
        return;
      }

      idle += 1;
    });

    return {
      active,
      idle,
      total: this.entries.size,
      waiting: this.waiters.length,
      maxConnections: this.config.maxConnections,
      metrics: { ...this.metrics },
    };
  }

  private async createEntry(connectionId: string, factory: AdapterFactory): Promise<ProtocolAdapter> {
    this.pendingCreates.add(connectionId);

    try {
      const adapter = await factory();
      this.entries.set(connectionId, {
        adapter,
        lastUsed: Date.now(),
        state: "busy",
      });
      this.metrics.created += 1;
      return adapter;
    } finally {
      this.pendingCreates.delete(connectionId);
      void this.drainWaiters();
    }
  }

  private waitForAdapter(connectionId: string, factory: AdapterFactory): Promise<ProtocolAdapter> {
    return new Promise<ProtocolAdapter>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.metrics.acquireTimeouts += 1;
        this.removeWaiter(waiter);
        reject(
          new AppError({
            code: ErrorCode.CONNECTION_TIMEOUT,
            message: `Timed out waiting for connection ${connectionId}`,
            details: {
              connectionId,
              timeoutMs: this.config.acquireTimeoutMs,
            },
          }),
        );
      }, this.config.acquireTimeoutMs);

      const waiter: AcquireWaiter = {
        connectionId,
        factory,
        resolve,
        reject,
        timeoutHandle,
      };

      this.waiters.push(waiter);
      void this.drainWaiters();
    });
  }

  private removeWaiter(target: AcquireWaiter): void {
    const index = this.waiters.indexOf(target);
    if (index >= 0) {
      this.waiters.splice(index, 1);
    }
  }

  private isAtCapacity(): boolean {
    return this.entries.size + this.pendingCreates.size >= this.config.maxConnections;
  }

  private findSatisfiableWaiterIndex(): number {
    for (let index = 0; index < this.waiters.length; index += 1) {
      const waiter = this.waiters[index];
      const entry = this.entries.get(waiter.connectionId);

      if (entry?.state === "idle") {
        return index;
      }

      if (!entry && !this.pendingCreates.has(waiter.connectionId) && !this.isAtCapacity()) {
        return index;
      }
    }

    return -1;
  }

  private async drainWaiters(): Promise<void> {
    if (this.isDraining) {
      return;
    }

    this.isDraining = true;

    try {
      while (this.waiters.length > 0) {
        const satisfiableIndex = this.findSatisfiableWaiterIndex();
        if (satisfiableIndex === -1) {
          return;
        }

        const [waiter] = this.waiters.splice(satisfiableIndex, 1);
        clearTimeout(waiter.timeoutHandle);

        const existingEntry = this.entries.get(waiter.connectionId);
        if (existingEntry?.state === "idle") {
          existingEntry.state = "busy";
          existingEntry.lastUsed = Date.now();
          this.metrics.reused += 1;
          waiter.resolve(existingEntry.adapter);
          continue;
        }

        if (
          !existingEntry &&
          !this.pendingCreates.has(waiter.connectionId) &&
          !this.isAtCapacity()
        ) {
          try {
            const adapter = await this.createEntry(waiter.connectionId, waiter.factory);
            waiter.resolve(adapter);
          } catch (error) {
            waiter.reject(error);
          }
        }
      }
    } finally {
      this.isDraining = false;
    }
  }

  private async pruneIdleEntries(): Promise<void> {
    if (this.entries.size === 0) {
      return;
    }

    const now = Date.now();
    const staleConnectionIds: string[] = [];

    this.entries.forEach((entry, connectionId) => {
      if (entry.state !== "idle") {
        return;
      }

      if (now - entry.lastUsed >= this.config.idleTimeoutMs) {
        staleConnectionIds.push(connectionId);
      }
    });

    if (staleConnectionIds.length === 0) {
      return;
    }

    this.metrics.idleEvictions += staleConnectionIds.length;
    await Promise.all(staleConnectionIds.map(async (connectionId) => this.destroy(connectionId)));
  }
}

function toLogError(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    const code =
      typeof (error as { code?: unknown }).code === "string"
        ? ((error as { code?: string }).code ?? undefined)
        : undefined;
    return {
      message: error.message,
      code,
    };
  }

  return {
    message: String(error),
  };
}
