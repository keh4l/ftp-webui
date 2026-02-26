"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BatchDeleteDialog } from "@/components/files/batch-delete-dialog";
import { BatchResultPanel } from "@/components/files/batch-result-panel";
import { FileBreadcrumb } from "@/components/files/file-breadcrumb";
import { FileTable } from "@/components/files/file-table";
import { FileToolbar } from "@/components/files/file-toolbar";
import type { FileEntry } from "@/lib/protocol/types";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type BatchItemResult = {
  path: string;
  success: boolean;
  error?: string;
};

function normalizePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed === "/") return "/";
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutDuplicateSlash = normalized.replace(/\/{2,}/g, "/");
  return withoutDuplicateSlash.length > 1 ? withoutDuplicateSlash.replace(/\/$/, "") : "/";
}

function parentPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const segments = normalized.split("/").filter(Boolean);
  segments.pop();
  return segments.length ? `/${segments.join("/")}` : "/";
}

function childPath(currentPath: string, name: string): string {
  const base = normalizePath(currentPath);
  if (base === "/") return normalizePath(`/${name}`);
  return normalizePath(`${base}/${name}`);
}

function parseErrorPayload(payload: unknown): ApiErrorResponse["error"] {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return undefined;
  const maybeError = (payload as ApiErrorResponse).error;
  if (!maybeError || typeof maybeError !== "object") return undefined;
  return maybeError;
}

export default function FileBrowserPage() {
  const params = useParams<{ connectionId: string }>();
  const router = useRouter();
  const connectionId = typeof params.connectionId === "string" ? params.connectionId : "";

  const [currentPath, setCurrentPath] = useState("/");
  const [pathInput, setPathInput] = useState("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionMissing, setConnectionMissing] = useState(false);
  const [transferStatus, setTransferStatus] = useState("尚未执行传输");
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Batch selection state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchItemResult[]>([]);
  const [showBatchResults, setShowBatchResults] = useState(false);

  const closeBatchDeleteDialog = useCallback(() => {
    setShowBatchDeleteDialog(false);
    requestAnimationFrame(() => {
      const trigger = document.querySelector<HTMLButtonElement>('[data-testid="batch-delete-btn"]');
      trigger?.focus();
    });
  }, []);

  const clearToasts = useCallback(() => {
    setErrorToast(null);
    setSuccessToast(null);
  }, []);

  const loadDirectory = useCallback(
    async (targetPath: string, options?: { keepLoading?: boolean }) => {
      if (!connectionId) return;
      const normalizedPath = normalizePath(targetPath);
      if (!options?.keepLoading) setIsLoading(true);

      try {
        const response = await fetch(
          `/api/connections/${encodeURIComponent(connectionId)}/files?path=${encodeURIComponent(normalizedPath)}`,
          { method: "GET" },
        );
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          const apiError = parseErrorPayload(payload);
          const code = apiError?.code;
          const message = apiError?.message ?? "目录加载失败";

          if (response.status === 404 || code === "CONNECTION_NOT_FOUND") {
            setConnectionMissing(true);
            setEntries([]);
            setCurrentPath("/");
            setPathInput("/");
            setErrorToast(message);
            setTransferStatus("连接已失效，请返回连接列表恢复会话");
            return;
          }
          throw new Error(message);
        }

        const files = Array.isArray(payload) ? (payload as FileEntry[]) : [];
        const sorted = [...files].sort((left, right) => {
          if (left.type === "directory" && right.type !== "directory") return -1;
          if (left.type !== "directory" && right.type === "directory") return 1;
          return left.name.localeCompare(right.name, "zh-CN", { numeric: true, sensitivity: "base" });
        });

        setConnectionMissing(false);
        setEntries(sorted);
        setCurrentPath(normalizedPath);
        setPathInput(normalizedPath);
        setSelectedPaths(new Set());
      } catch (error) {
        const message = error instanceof Error ? error.message : "目录加载失败";
        setErrorToast(message);
      } finally {
        setIsLoading(false);
      }
    },
    [connectionId],
  );

  useEffect(() => {
    void loadDirectory("/");
  }, [loadDirectory]);

  useEffect(() => {
    if (!errorToast && !successToast) return;
    const timer = window.setTimeout(() => clearToasts(), 3200);
    return () => window.clearTimeout(timer);
  }, [clearToasts, errorToast, successToast]);

  const canGoParent = currentPath !== "/";
  const pageTitle = useMemo(() => `文件浏览 · ${currentPath}`, [currentPath]);

  const handleNavigate = useCallback(
    (targetPath: string) => {
      clearToasts();
      void loadDirectory(targetPath);
    },
    [clearToasts, loadDirectory],
  );

  const handlePathSubmit = useCallback(() => {
    clearToasts();
    void loadDirectory(pathInput);
  }, [clearToasts, loadDirectory, pathInput]);

  const handleRefresh = useCallback(() => {
    clearToasts();
    setTransferStatus(`刷新目录 ${currentPath}`);
    void loadDirectory(currentPath, { keepLoading: true });
  }, [clearToasts, currentPath, loadDirectory]);

  const handleOpenDirectory = useCallback(
    (entry: FileEntry) => {
      const targetPath = entry.path ? normalizePath(entry.path) : childPath(currentPath, entry.name);
      void loadDirectory(targetPath);
    },
    [currentPath, loadDirectory],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      if (!connectionId) return;
      clearToasts();
      setTransferStatus(`正在上传 ${file.name}`);

      try {
        const formData = new FormData();
        formData.set("remotePath", childPath(currentPath, file.name));
        formData.set("file", file);

        const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/files/upload`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response.json()) as unknown;
          const apiError = parseErrorPayload(payload);
          throw new Error(apiError?.message ?? "上传失败");
        }

        setSuccessToast(`已上传 ${file.name}`);
        setTransferStatus(`上传完成：${file.name}`);
        await loadDirectory(currentPath, { keepLoading: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "上传失败";
        setErrorToast(message);
        setTransferStatus(`上传失败：${file.name}`);
      }
    },
    [clearToasts, connectionId, currentPath, loadDirectory],
  );

  const handleDownload = useCallback(
    (entry: FileEntry) => {
      if (!connectionId) return;
      clearToasts();
      const targetPath = entry.path ? normalizePath(entry.path) : childPath(currentPath, entry.name);
      const downloadUrl = `/api/connections/${encodeURIComponent(connectionId)}/files/download?path=${encodeURIComponent(targetPath)}`;
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
      setSuccessToast(`已发起下载 ${entry.name}`);
      setTransferStatus(`下载已开始：${entry.name}`);
    },
    [clearToasts, connectionId, currentPath],
  );

  // --- Editor navigation ---
  const handleEdit = useCallback(
    (entry: FileEntry) => {
      if (!connectionId) return;
      const targetPath = entry.path ? normalizePath(entry.path) : childPath(currentPath, entry.name);
      router.push(`/files/${encodeURIComponent(connectionId)}/edit?path=${encodeURIComponent(targetPath)}`);
    },
    [connectionId, currentPath, router],
  );

  // --- Batch selection ---
  const entryFullPath = useCallback(
    (entry: FileEntry) => entry.path ?? entry.name,
    [],
  );

  const handleToggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedPaths((prev) => {
      const allPaths = entries.map(entryFullPath);
      const allSelected = allPaths.length > 0 && allPaths.every((p) => prev.has(p));
      if (allSelected) return new Set();
      return new Set(allPaths);
    });
  }, [entries, entryFullPath]);

  // --- Batch delete ---
  const executeBatchDelete = useCallback(
    async (paths: string[]) => {
      if (!connectionId || paths.length === 0) return;
      setShowBatchDeleteDialog(false);
      clearToasts();
      setTransferStatus(`正在批量删除 ${paths.length} 个项目...`);

      try {
        const response = await fetch(
          `/api/connections/${encodeURIComponent(connectionId)}/files/batch`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", paths }),
          },
        );

        const payload = (await response.json()) as { results?: BatchItemResult[] };

        if (!response.ok) {
          const apiError = parseErrorPayload(payload as unknown);
          throw new Error(apiError?.message ?? "批量删除失败");
        }

        const results = payload.results ?? [];
        setBatchResults(results);
        setShowBatchResults(true);

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.length - successCount;

        if (failCount === 0) {
          setSuccessToast(`已成功删除 ${successCount} 个项目`);
        } else {
          setErrorToast(`${successCount} 成功，${failCount} 失败`);
        }

        setTransferStatus(`批量删除完成：${successCount} 成功，${failCount} 失败`);
        setSelectedPaths(new Set());
        await loadDirectory(currentPath, { keepLoading: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "批量删除失败";
        setErrorToast(message);
        setTransferStatus(`批量删除失败`);
      }
    },
    [clearToasts, connectionId, currentPath, loadDirectory],
  );

  const handleBatchRetry = useCallback(
    (paths: string[]) => {
      void executeBatchDelete(paths);
    },
    [executeBatchDelete],
  );

  if (connectionMissing) {
    return (
      <main className="min-h-screen bg-bg-deep px-4 py-10 text-text-primary md:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border-default bg-bg-secondary/70 p-8 text-center">
          <h1 className="text-2xl font-[family-name:var(--font-lexend)] font-semibold tracking-tight">
            连接已失效
          </h1>
          <p className="mt-3 text-text-secondary">当前会话无法继续浏览，请返回连接页重新建立连接。</p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/connections"
              className="inline-flex items-center gap-2 rounded-md border border-border-default px-4 py-2 text-sm text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回连接页
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-deep px-4 py-6 text-text-primary md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-[family-name:var(--font-lexend)] font-semibold tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-text-secondary">连接 ID：{connectionId || "-"}</p>
        </header>

        <FileBreadcrumb path={currentPath} onNavigateAction={handleNavigate} />

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border-default bg-bg-secondary px-3 text-sm text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => handleNavigate(parentPath(currentPath))}
            disabled={!canGoParent || isLoading}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回上级
          </button>
        </div>

        <FileToolbar
          pathInput={pathInput}
          isLoading={isLoading}
          selectedCount={selectedPaths.size}
          onPathInputChangeAction={setPathInput}
          onPathSubmitAction={handlePathSubmit}
          onRefreshAction={handleRefresh}
          onUploadAction={handleUpload}
          onBatchDeleteAction={() => setShowBatchDeleteDialog(true)}
        />

        {errorToast ? (
          <div
            className="rounded-md border border-red-400/60 bg-red-500/10 px-4 py-2 text-sm text-red-100"
            data-testid="toast-error"
          >
            {errorToast}
          </div>
        ) : null}

        {successToast ? (
          <div
            className="rounded-md border border-accent/70 bg-accent/10 px-4 py-2 text-sm text-accent"
            data-testid="toast-success"
          >
            {successToast}
          </div>
        ) : null}

        <section
          className="rounded-md border border-border-default bg-bg-primary/60 px-3 py-2 text-xs text-text-secondary"
          aria-live="polite"
          data-testid="transfer-latest-status"
        >
          {transferStatus}
        </section>

        {showBatchResults ? (
          <BatchResultPanel
            results={batchResults}
            isOpen={showBatchResults}
            onRetryAction={handleBatchRetry}
            onCloseAction={() => setShowBatchResults(false)}
          />
        ) : null}

        <FileTable
          entries={entries}
          isLoading={isLoading}
          selectedPaths={selectedPaths}
          onOpenDirectoryAction={handleOpenDirectory}
          onDownloadAction={handleDownload}
          onEditAction={handleEdit}
          onToggleSelectAction={handleToggleSelect}
          onToggleSelectAllAction={handleToggleSelectAll}
        />
      </div>

      <BatchDeleteDialog
        paths={Array.from(selectedPaths)}
        isOpen={showBatchDeleteDialog}
        onConfirmAction={executeBatchDelete}
        onCancelAction={closeBatchDeleteDialog}
      />
    </main>
  );
}
