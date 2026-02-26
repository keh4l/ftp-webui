import type { FileEntry, FileType, ProtocolAdapter } from "@/lib/protocol/types";
import { logger } from "@/lib/logger";

import { normalizePath } from "./path-utils";

const DIRECTORY_SKIP_NAMES = new Set([".", ".."]);

export type BrowseAdapterResolver = (
  connectionId: string,
) => Promise<ProtocolAdapter> | ProtocolAdapter;

export type BrowseServiceDeps = {
  getAdapter: BrowseAdapterResolver;
};

export class BrowseService {
  private readonly getAdapter: BrowseAdapterResolver;

  constructor(deps: BrowseServiceDeps | BrowseAdapterResolver) {
    this.getAdapter = typeof deps === "function" ? deps : deps.getAdapter;
  }

  async list(connectionId: string, remotePath: string): Promise<FileEntry[]> {
    const normalizedPath = normalizePath(remotePath);
    logger.info(
      {
        connectionId,
        remotePath: normalizedPath,
      },
      "List remote directory",
    );

    const adapter = await this.getAdapter(connectionId);
    const entries = await adapter.list(normalizedPath);

    const normalizedEntries = entries
      .map((entry) => this.normalizeEntry(entry, normalizedPath))
      .filter((entry): entry is FileEntry => entry !== null);

    logger.info(
      {
        connectionId,
        remotePath: normalizedPath,
        entryCount: normalizedEntries.length,
      },
      "Listed remote directory",
    );

    return normalizedEntries;
  }

  async stat(connectionId: string, remotePath: string): Promise<FileEntry> {
    const normalizedPath = normalizePath(remotePath);
    logger.info(
      {
        connectionId,
        remotePath: normalizedPath,
      },
      "Stat remote entry",
    );

    const adapter = await this.getAdapter(connectionId);
    const entry = await adapter.stat(normalizedPath);
    const normalizedEntry = this.normalizeStatEntry(entry, normalizedPath);

    logger.info(
      {
        connectionId,
        remotePath: normalizedPath,
        type: normalizedEntry.type,
      },
      "Stated remote entry",
    );

    return normalizedEntry;
  }

  private normalizeEntry(entry: FileEntry, basePath: string): FileEntry | null {
    const name = this.normalizeName(entry);
    if (!name || DIRECTORY_SKIP_NAMES.has(name)) {
      return null;
    }

    const path = this.normalizeEntryPath(entry.path, basePath, name);
    if (!path) {
      return null;
    }

    return {
      ...entry,
      name,
      path,
      type: this.normalizeType(entry.type),
      size: this.normalizeSize(entry.size),
      modifiedAt: this.normalizeModifiedAt(entry.modifiedAt),
      permissions: this.normalizePermissions(entry.permissions),
    };
  }

  private normalizeStatEntry(entry: FileEntry, requestedPath: string): FileEntry {
    const name = this.normalizeName(entry) ?? this.lastSegment(requestedPath);
    const path = this.normalizeEntryPath(entry.path, requestedPath, name) ?? requestedPath;

    return {
      ...entry,
      name,
      path,
      type: this.normalizeType(entry.type),
      size: this.normalizeSize(entry.size),
      modifiedAt: this.normalizeModifiedAt(entry.modifiedAt),
      permissions: this.normalizePermissions(entry.permissions),
    };
  }

  private normalizeName(entry: FileEntry): string | null {
    const trimmedName = entry.name.trim();
    if (trimmedName) {
      return trimmedName;
    }

    if (!entry.path.trim()) {
      return null;
    }

    try {
      return this.lastSegment(normalizePath(entry.path));
    } catch {
      return null;
    }
  }

  private normalizeEntryPath(rawPath: string, basePath: string, name: string): string | null {
    const candidatePath = rawPath.trim() || this.resolveChildPath(basePath, name);
    try {
      return normalizePath(candidatePath);
    } catch {
      logger.warn(
        {
          candidatePath,
          basePath,
          name,
        },
        "Skip directory entry with invalid path",
      );
      return null;
    }
  }

  private resolveChildPath(basePath: string, name: string): string {
    if (basePath === "/") {
      return `/${name}`;
    }

    return `${basePath.replace(/\/+$/, "")}/${name}`;
  }

  private lastSegment(remotePath: string): string {
    const segments = remotePath.split("/").filter(Boolean);
    return segments.at(-1) ?? "/";
  }

  private normalizeType(value: FileType): FileType {
    if (value === "file" || value === "directory" || value === "symlink" || value === "unknown") {
      return value;
    }

    return "unknown";
  }

  private normalizeSize(value: number | null): number | null {
    if (typeof value !== "number") {
      return null;
    }

    return Number.isFinite(value) ? value : null;
  }

  private normalizeModifiedAt(value: string | null): string | null {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      return null;
    }

    return date.toISOString();
  }

  private normalizePermissions(value: string | undefined): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
  }
}
