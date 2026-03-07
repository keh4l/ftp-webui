"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BatchDeleteDialog } from "@/components/files/batch-delete-dialog";
import { BatchMoveDialog } from "@/components/files/batch-move-dialog";
import { CreateEntryDialog } from "@/components/files/create-entry-dialog";
import { BatchResultPanel } from "@/components/files/batch-result-panel";
import { FileBreadcrumb } from "@/components/files/file-breadcrumb";
import { FileTable } from "@/components/files/file-table";
import { FileToolbar } from "@/components/files/file-toolbar";
import { Toast, type ToastItem, type ToastVariant } from "@/components/ui/toast";
import {
  sortFileEntries,
  type FileSortDirection,
  type FileSortField,
} from "@/lib/file/sort";
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

function normalizeEntryName(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return null;
  }

  return trimmed;
}

export default function FileBrowserPage() {
  const params = useParams<{ connectionId: string }>();
  const router = useRouter();
  const connectionId = typeof params.connectionId === "string" ? params.connectionId : "";

  const [currentPath, setCurrentPath] = useState("/");
  const [pathInput, setPathInput] = useState("/");
  const [sortField, setSortField] = useState<FileSortField>("name");
  const [sortDirection, setSortDirection] = useState<FileSortDirection>("asc");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [connectionMissing, setConnectionMissing] = useState(false);
  const [transferStatus, setTransferStatus] = useState("尚未执行传输");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Batch selection state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showCreateEntryDialog, setShowCreateEntryDialog] = useState(false);
  const [createEntryDialogType, setCreateEntryDialogType] = useState<"file" | "directory">("file");
  const [createEntryDialogKey, setCreateEntryDialogKey] = useState(0);
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false);
  const [batchMoveDialogKey, setBatchMoveDialogKey] = useState(0);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchItemResult[]>([]);
  const [showBatchResults, setShowBatchResults] = useState(false);

  const closeCreateEntryDialog = useCallback(() => {
    setShowCreateEntryDialog(false);
    requestAnimationFrame(() => {
      const testId = createEntryDialogType === "file" ? "file-create-btn" : "folder-create-btn";
      const trigger = document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
      trigger?.focus();
    });
  }, [createEntryDialogType]);

  const closeBatchMoveDialog = useCallback(() => {
    setShowBatchMoveDialog(false);
    requestAnimationFrame(() => {
      const trigger = document.querySelector<HTMLButtonElement>('[data-testid="batch-move-btn"]');
      trigger?.focus();
    });
  }, []);

  const closeBatchDeleteDialog = useCallback(() => {
    setShowBatchDeleteDialog(false);
    requestAnimationFrame(() => {
      const trigger = document.querySelector<HTMLButtonElement>('[data-testid="batch-delete-btn"]');
      trigger?.focus();
    });
  }, []);

  const pushToast = useCallback((variant: ToastVariant, title: string, description?: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, variant, title, description }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
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
            pushToast("error", message);
            setTransferStatus("连接已失效，请返回连接列表恢复会话");
            return;
          }
          throw new Error(message);
        }

        const files = Array.isArray(payload) ? (payload as FileEntry[]) : [];

        setConnectionMissing(false);
        setEntries(files);
        setCurrentPath(normalizedPath);
        setPathInput(normalizedPath);
        setSelectedPaths(new Set());
      } catch (error) {
        const message = error instanceof Error ? error.message : "目录加载失败";
        pushToast("error", message);
      } finally {
        setIsLoading(false);
      }
    },
    [connectionId, pushToast],
  );

  useEffect(() => {
    void loadDirectory("/");
  }, [loadDirectory]);

  const canGoParent = currentPath !== "/";
  const isBusy = isLoading || isMoving;
  const pageTitle = useMemo(() => `文件浏览 · ${currentPath}`, [currentPath]);
  const sortedEntries = useMemo(
    () => sortFileEntries(entries, sortField, sortDirection),
    [entries, sortDirection, sortField],
  );

  const handleSortFieldToggle = useCallback(
    (field: FileSortField) => {
      setSortDirection(sortField === field ? (sortDirection === "asc" ? "desc" : "asc") : "asc");
      setSortField(field);
    },
    [sortDirection, sortField],
  );

  const handleNavigate = useCallback(
    (targetPath: string) => {
      void loadDirectory(targetPath);
    },
    [loadDirectory],
  );

  const handlePathSubmit = useCallback(() => {
    void loadDirectory(pathInput);
  }, [loadDirectory, pathInput]);

  const handleRefresh = useCallback(() => {
    setTransferStatus(`刷新目录 ${currentPath}`);
    void loadDirectory(currentPath, { keepLoading: true });
  }, [currentPath, loadDirectory]);

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

        pushToast("success", "上传完成", file.name);
        setTransferStatus(`上传完成：${file.name}`);
        await loadDirectory(currentPath, { keepLoading: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "上传失败";
        pushToast("error", "上传失败", message);
        setTransferStatus(`上传失败：${file.name}`);
      }
    },
    [connectionId, currentPath, loadDirectory, pushToast],
  );

  const handleDownload = useCallback(
    (entry: FileEntry) => {
      if (!connectionId) return;
      const targetPath = entry.path ? normalizePath(entry.path) : childPath(currentPath, entry.name);
      const downloadUrl = `/api/connections/${encodeURIComponent(connectionId)}/files/download?path=${encodeURIComponent(targetPath)}`;
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
      pushToast("success", "已发起下载", entry.name);
      setTransferStatus(`下载已开始：${entry.name}`);
    },
    [connectionId, currentPath, pushToast],
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

  const executeMoveEntries = useCallback(
    async (sourceEntries: FileEntry[], destinationDirPath: string, destinationLabel: string) => {
      if (!connectionId || sourceEntries.length === 0) return;

      const sourcePathMap = new Map<string, FileEntry>();
      for (const entry of sourceEntries) {
        const sourcePath = entry.path ? normalizePath(entry.path) : childPath(currentPath, entry.name);

        if (
          entry.type === "directory" &&
          (destinationDirPath === sourcePath || destinationDirPath.startsWith(`${sourcePath}/`))
        ) {
          pushToast("error", "移动失败", `不能将目录「${entry.name}」移动到自身或其子目录`);
          setTransferStatus(`移动失败：${entry.name}`);
          return;
        }

        if (parentPath(sourcePath) === destinationDirPath || sourcePath === destinationDirPath) {
          continue;
        }

        sourcePathMap.set(sourcePath, entry);
      }

      const sourcePaths = Array.from(sourcePathMap.keys());
      if (sourcePaths.length === 0) {
        setTransferStatus(`所选项目已在目标目录：${destinationLabel}`);
        return;
      }

      const moveLabel = sourcePaths.length === 1 ? sourceEntries[0]?.name ?? sourcePaths[0] : `${sourcePaths.length} 个项目`;
      setIsMoving(true);
      setTransferStatus(`正在移动 ${moveLabel} → ${destinationLabel}`);

      try {
        const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/files/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "move",
            sourcePaths,
            destinationDir: destinationDirPath,
          }),
        });
        const payload = (await response.json()) as { results?: BatchItemResult[] };

        if (!response.ok) {
          const apiError = parseErrorPayload(payload as unknown);
          throw new Error(apiError?.message ?? "移动失败");
        }

        const results = payload.results ?? [];
        const successCount = results.filter((item) => item.success).length;
        const failCount = results.length - successCount;

        if (failCount === 0) {
          pushToast("success", "批量移动完成", `已移动 ${successCount} 个项目到 ${destinationLabel}`);
        } else {
          pushToast("error", "批量移动部分失败", `${successCount} 成功，${failCount} 失败`);
        }

        setTransferStatus(`移动完成：${successCount} 成功，${failCount} 失败`);
        setSelectedPaths(new Set());
        await loadDirectory(currentPath, { keepLoading: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "移动失败";
        pushToast("error", "移动失败", message);
        setTransferStatus(`移动失败：${moveLabel}`);
      } finally {
        setIsMoving(false);
      }
    },
    [connectionId, currentPath, loadDirectory, pushToast],
  );

  const handleMoveEntries = useCallback(
    (sourceEntries: FileEntry[], destinationDirectory: FileEntry) => {
      const destinationDirPath = destinationDirectory.path
        ? normalizePath(destinationDirectory.path)
        : childPath(currentPath, destinationDirectory.name);

      void executeMoveEntries(sourceEntries, destinationDirPath, destinationDirectory.name);
    },
    [currentPath, executeMoveEntries],
  );

  const handleBatchMove = useCallback(() => {
    if (selectedPaths.size === 0) {
      setTransferStatus("请先选择要移动的文件或文件夹");
      return;
    }

    setBatchMoveDialogKey((prev) => prev + 1);
    setShowBatchMoveDialog(true);
  }, [selectedPaths.size]);

  const executeBatchMove = useCallback(
    (destinationInput: string) => {
      let destinationDirPath = "/";
      try {
        destinationDirPath = normalizePath(destinationInput);
      } catch {
        pushToast("error", "目标目录路径不合法");
        return;
      }

      const selectedEntries = entries.filter((entry) => selectedPaths.has(entry.path ?? entry.name));
      if (selectedEntries.length === 0) {
        pushToast("error", "未找到可移动的已选项目");
        return;
      }

      closeBatchMoveDialog();
      void executeMoveEntries(selectedEntries, destinationDirPath, destinationDirPath);
    },
    [closeBatchMoveDialog, entries, executeMoveEntries, pushToast, selectedPaths],
  );

  const executeCreateEntry = useCallback(
    async (entryType: "file" | "directory", name: string) => {
      if (!connectionId) return;

      const noun = entryType === "file" ? "文件" : "文件夹";
      const action = entryType === "file" ? "create_file" : "create_directory";
      const targetPath = childPath(currentPath, name);
      setIsMoving(true);
      setTransferStatus(`正在创建${noun}：${name}`);

      try {
        const response = await fetch(`/api/connections/${encodeURIComponent(connectionId)}/files/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, path: targetPath }),
        });
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          const apiError = parseErrorPayload(payload);
          throw new Error(apiError?.message ?? `创建${noun}失败`);
        }

        pushToast("success", `已创建${noun}`, name);
        setTransferStatus(`创建完成：${name}`);
        await loadDirectory(currentPath, { keepLoading: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : `创建${noun}失败`;
        pushToast("error", `创建${noun}失败`, message);
        setTransferStatus(`创建失败：${name}`);
      } finally {
        setIsMoving(false);
      }
    },
    [connectionId, currentPath, loadDirectory, pushToast],
  );

  const openCreateEntryDialog = useCallback((entryType: "file" | "directory") => {
    setCreateEntryDialogType(entryType);
    setCreateEntryDialogKey((prev) => prev + 1);
    setShowCreateEntryDialog(true);
  }, []);

  const handleCreateEntryConfirm = useCallback(
    (inputName: string) => {
      const noun = createEntryDialogType === "file" ? "文件" : "文件夹";
      const name = normalizeEntryName(inputName);

      if (!name) {
        pushToast("error", `${noun}名称不合法`);
        return;
      }

      closeCreateEntryDialog();
      void executeCreateEntry(createEntryDialogType, name);
    },
    [closeCreateEntryDialog, createEntryDialogType, executeCreateEntry, pushToast],
  );

  const handleCreateFile = useCallback(() => {
    openCreateEntryDialog("file");
  }, [openCreateEntryDialog]);

  const handleCreateFolder = useCallback(() => {
    openCreateEntryDialog("directory");
  }, [openCreateEntryDialog]);

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

  const handleSetPathSelected = useCallback((path: string, selected: boolean) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(path);
      } else {
        next.delete(path);
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
          pushToast("success", "批量删除完成", `已成功删除 ${successCount} 个项目`);
        } else {
          pushToast("error", "批量删除部分失败", `${successCount} 成功，${failCount} 失败`);
        }

        setTransferStatus(`批量删除完成：${successCount} 成功，${failCount} 失败`);
        setSelectedPaths(new Set());
        await loadDirectory(currentPath, { keepLoading: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "批量删除失败";
        pushToast("error", "批量删除失败", message);
        setTransferStatus(`批量删除失败`);
      }
    },
    [connectionId, currentPath, loadDirectory, pushToast],
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
        <header className="rounded-2xl border border-border-default bg-bg-primary p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="space-y-1">
                <h1 className="text-2xl font-[family-name:var(--font-lexend)] font-semibold tracking-tight">{pageTitle}</h1>
                <p className="text-sm text-text-secondary">围绕当前目录执行浏览、上传、编辑与批量操作。</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-border-default bg-bg-secondary px-2.5 py-1 text-text-secondary">
                  连接 ID：{connectionId || "-"}
                </span>
                <span className="rounded-full border border-border-default bg-bg-secondary px-2.5 py-1 text-text-secondary">
                  当前目录：{currentPath}
                </span>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-accent">
                  已选 {selectedPaths.size} 项
                </span>
              </div>

              <FileBreadcrumb path={currentPath} onNavigateAction={handleNavigate} />
            </div>

            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-4 text-sm text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => handleNavigate(parentPath(currentPath))}
              disabled={!canGoParent || isBusy}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回上级
            </button>
          </div>
        </header>

        <div className="sticky top-16 z-20 rounded-2xl border border-border-default bg-bg-deep/90 p-1 backdrop-blur">
          <FileToolbar
            pathInput={pathInput}
            isLoading={isBusy}
            selectedCount={selectedPaths.size}
            onPathInputChangeAction={setPathInput}
            onPathSubmitAction={handlePathSubmit}
            onRefreshAction={handleRefresh}
            onCreateFileAction={handleCreateFile}
            onCreateFolderAction={handleCreateFolder}
            onUploadAction={handleUpload}
            onBatchMoveAction={handleBatchMove}
            onBatchDeleteAction={() => setShowBatchDeleteDialog(true)}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-4">
            <FileTable
              entries={sortedEntries}
              isLoading={isBusy}
              selectedPaths={selectedPaths}
              sortField={sortField}
              sortDirection={sortDirection}
              onOpenDirectoryAction={handleOpenDirectory}
              onDownloadAction={handleDownload}
              onEditAction={handleEdit}
              onSortFieldToggleAction={handleSortFieldToggle}
              onMoveEntriesAction={handleMoveEntries}
              onSetPathSelectedAction={handleSetPathSelected}
              onToggleSelectAction={handleToggleSelect}
              onToggleSelectAllAction={handleToggleSelectAll}
            />
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border-default bg-bg-primary p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">目录概览</p>
              <p className="mt-3 break-all font-mono text-sm text-text-primary">{currentPath}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl border border-border-default bg-bg-secondary/80 p-3">
                  <p className="text-xs text-text-secondary">目录项</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{sortedEntries.length}</p>
                </div>
                <div className="rounded-xl border border-border-default bg-bg-secondary/80 p-3">
                  <p className="text-xs text-text-secondary">已选项目</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{selectedPaths.size}</p>
                </div>
              </div>
            </section>

            <section
              className="rounded-2xl border border-border-default bg-bg-primary p-4"
              aria-live="polite"
              data-testid="transfer-latest-status"
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-secondary">最近状态</p>
              <p className="mt-3 text-sm text-text-primary">{transferStatus}</p>
            </section>

            {showBatchResults ? (
              <BatchResultPanel
                results={batchResults}
                isOpen={showBatchResults}
                onRetryAction={handleBatchRetry}
                onCloseAction={() => setShowBatchResults(false)}
              />
            ) : null}
          </aside>
        </div>
      </div>

      <CreateEntryDialog
        key={createEntryDialogKey}
        entryType={createEntryDialogType}
        isOpen={showCreateEntryDialog}
        onConfirmAction={handleCreateEntryConfirm}
        onCancelAction={closeCreateEntryDialog}
      />

      <BatchDeleteDialog
        paths={Array.from(selectedPaths)}
        isOpen={showBatchDeleteDialog}
        onConfirmAction={executeBatchDelete}
        onCancelAction={closeBatchDeleteDialog}
      />

      <BatchMoveDialog
        key={batchMoveDialogKey}
        paths={Array.from(selectedPaths)}
        initialDestination={currentPath}
        isOpen={showBatchMoveDialog}
        onConfirmAction={executeBatchMove}
        onCancelAction={closeBatchMoveDialog}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
