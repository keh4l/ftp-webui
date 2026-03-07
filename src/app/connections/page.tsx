"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Server, X } from "lucide-react";
import {
  ConnectionDeleteDialog,
} from "@/components/connections/connection-delete-dialog";
import {
  ConnectionFormDialog,
  type ConnectionFormValues,
} from "@/components/connections/connection-form-dialog";
import {
  ConnectionList,
  type ConnectionItem,
  type ConnectionStatus,
} from "@/components/connections/connection-list";
import { Toast, type ToastItem, type ToastVariant } from "@/components/ui/toast";

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type TestResult = {
  success: boolean;
  latencyMs: number;
  error?: {
    message?: string;
  };
};

type AuthMeResult = {
  authenticated: boolean;
};

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

async function parseApiError(response: Response): Promise<string> {
  const fallback = `请求失败 (${response.status})`;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    if (payload?.error?.message) {
      return payload.error.message;
    }

    return fallback;
  }

  const text = await response.text();
  return text.trim() || fallback;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export default function ConnectionsPage() {
  const router = useRouter();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [statusById, setStatusById] = useState<Record<string, ConnectionStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingConnection, setEditingConnection] = useState<ConnectionItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingConnection, setDeletingConnection] = useState<ConnectionItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((previous) => [...previous, { id, variant, title, description }]);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const refreshConnections = useCallback(async (showPageLoader: boolean) => {
    if (showPageLoader) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setPageError(null);

    try {
      const list = await requestJson<ConnectionItem[]>("/api/connections");
      setConnections(list);
      setStatusById((previous) => {
        const next: Record<string, ConnectionStatus> = {};
        for (const connection of list) {
          next[connection.id] = previous[connection.id] ?? { state: "idle" };
        }
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取连接列表失败";
      setPageError(message);
      pushToast("error", "加载连接失败", message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [pushToast]);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const result = await requestJson<AuthMeResult>("/api/auth/me");
        if (!result.authenticated) {
          router.replace("/login");
          return;
        }

        if (isMounted) {
          setIsAuthenticated(true);
        }
      } catch {
        router.replace("/login");
      } finally {
        if (isMounted) {
          setIsAuthChecked(true);
        }
      }
    };

    void checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void refreshConnections(true);
  }, [isAuthenticated, refreshConnections]);

  const formInitialValues = useMemo<Partial<ConnectionFormValues> | undefined>(() => {
    if (!editingConnection) {
      return undefined;
    }

    return {
      protocol: editingConnection.protocol,
      host: editingConnection.host,
      port: editingConnection.port,
      username: editingConnection.username,
      label: editingConnection.label ?? "",
    };
  }, [editingConnection]);

  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredConnections = useMemo(() => {
    if (!trimmedSearchQuery) {
      return connections;
    }

    return connections.filter((connection) => {
      const searchableFields = [
        connection.label ?? "",
        connection.host,
        connection.username,
        connection.protocol,
        String(connection.port),
      ];

      return searchableFields.some((field) => field.toLowerCase().includes(trimmedSearchQuery));
    });
  }, [connections, trimmedSearchQuery]);

  const openCreateForm = () => {
    setFormMode("create");
    setEditingConnection(null);
    setFormOpen(true);
  };

  const openEditForm = (connection: ConnectionItem) => {
    setFormMode("edit");
    setEditingConnection(connection);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) {
      return;
    }

    setFormOpen(false);
    setEditingConnection(null);
  };

  const saveConnection = async (values: ConnectionFormValues) => {
    const payload = {
      protocol: values.protocol,
      host: values.host.trim(),
      port: values.port,
      username: values.username.trim(),
      password: values.password,
      label: values.label.trim() || undefined,
    };

    setIsSaving(true);

    try {
      if (formMode === "create") {
        const created = await requestJson<ConnectionItem>("/api/connections", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setConnections((previous) => [created, ...previous]);
        setStatusById((previous) => ({ ...previous, [created.id]: { state: "idle" } }));
        pushToast("success", "连接已创建", `${created.host}:${created.port}`);
      } else if (editingConnection) {
        const updated = await requestJson<ConnectionItem>(
          `/api/connections/${editingConnection.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );

        setConnections((previous) =>
          previous.map((item) => (item.id === updated.id ? updated : item)),
        );
        pushToast("success", "连接已更新", `${updated.host}:${updated.port}`);
      }

      setFormOpen(false);
      setEditingConnection(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存连接失败";
      pushToast("error", "保存失败", message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const testConnectionDirect = async (values: ConnectionFormValues) => {
    const payload = {
      protocol: values.protocol,
      host: values.host.trim(),
      port: values.port,
      username: values.username.trim(),
      password: values.password,
    };

    try {
      const result = await requestJson<TestResult>("/api/connections/test", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (result.success) {
        const message = `直连成功，延迟 ${result.latencyMs}ms`;
        pushToast("success", "连接测试通过", message);
        return { success: true, message };
      }

      const message = result.error?.message || "连接测试失败";
      pushToast("error", "连接测试失败", message);
      return { success: false, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "连接测试失败";
      pushToast("error", "连接测试失败", message);
      return { success: false, message };
    }
  };

  const testStoredConnection = async (connectionId: string) => {
    setStatusById((previous) => ({
      ...previous,
      [connectionId]: { state: "testing", text: "测试中..." },
    }));

    try {
      const result = await requestJson<TestResult>(`/api/connections/${connectionId}/test`, {
        method: "POST",
      });

      if (result.success) {
        const text = `可用 · ${result.latencyMs}ms`;
        setStatusById((previous) => ({
          ...previous,
          [connectionId]: { state: "success", text },
        }));
        pushToast("success", "连接测试通过", text);
        return;
      }

      const text = result.error?.message || "连接测试失败";
      setStatusById((previous) => ({
        ...previous,
        [connectionId]: { state: "error", text },
      }));
      pushToast("error", "连接测试失败", text);
    } catch (error) {
      const text = error instanceof Error ? error.message : "连接测试失败";
      setStatusById((previous) => ({
        ...previous,
        [connectionId]: { state: "error", text },
      }));
      pushToast("error", "连接测试失败", text);
    }
  };

  const requestDeleteConnection = (connection: ConnectionItem) => {
    setDeletingConnection(connection);
  };

  const closeDeleteDialog = () => {
    if (deletingId) {
      return;
    }

    setDeletingConnection(null);
  };

  const confirmDelete = async () => {
    if (!deletingConnection) {
      return;
    }

    setDeletingId(deletingConnection.id);

    try {
      await requestJson<void>(`/api/connections/${deletingConnection.id}`, {
        method: "DELETE",
      });

      setConnections((previous) =>
        previous.filter((connection) => connection.id !== deletingConnection.id),
      );
      setStatusById((previous) => {
        const next = { ...previous };
        delete next[deletingConnection.id];
        return next;
      });

      pushToast(
        "success",
        "连接已删除",
        deletingConnection.label?.trim() || deletingConnection.host,
      );
      setDeletingConnection(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除连接失败";
      pushToast("error", "删除失败", message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isAuthChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-deep px-4">
        <div className="inline-flex items-center gap-3 rounded-xl border border-border-default bg-bg-primary px-5 py-3 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在验证登录状态...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg-deep text-text-primary">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
        <header className="rounded-2xl border border-border-default bg-bg-primary p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border-default bg-bg-secondary text-accent">
                <Server className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-[family-name:var(--font-lexend)] text-2xl font-semibold tracking-tight">
                  连接管理
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  创建、测试、编辑、删除 FTP/FTPS/SFTP 连接。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void refreshConnections(false);
                }}
                disabled={isRefreshing || isLoading}
                className={`inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                刷新
              </button>
              <button
                type="button"
                onClick={openCreateForm}
                data-testid="connection-add-btn"
                className={`inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 ${focusRingClass}`}
              >
                <Plus className="h-4 w-4" />
                新建连接
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索标签、主机、用户、协议或端口"
                className={`h-11 w-full rounded-lg border border-border-default bg-bg-secondary pl-10 pr-11 text-sm text-text-primary placeholder:text-text-secondary/70 ${focusRingClass}`}
                data-testid="connection-search-input"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={`absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-secondary transition hover:bg-bg-primary hover:text-text-primary ${focusRingClass}`}
                  aria-label="清空搜索"
                  data-testid="connection-search-clear-btn"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>

            <p className="text-sm text-text-secondary">
              {trimmedSearchQuery ? `显示 ${filteredConnections.length} / ${connections.length} 个连接` : `共 ${connections.length} 个连接`}
            </p>
          </div>
        </header>

        {pageError ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-300">
            {pageError}
          </div>
        ) : null}

        {isLoading ? (
          <section className="rounded-2xl border border-border-default bg-bg-primary p-10">
            <div className="flex items-center justify-center gap-3 text-text-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
              正在加载连接列表...
            </div>
          </section>
        ) : filteredConnections.length === 0 && connections.length > 0 ? (
          <section className="rounded-2xl border border-dashed border-border-default bg-bg-primary p-10 text-center">
            <div className="mx-auto max-w-md">
              <h2 className="font-[family-name:var(--font-lexend)] text-xl font-semibold text-text-primary">
                没有匹配的连接
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                试试更短的关键词，或清空搜索查看全部连接。
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={`mt-6 inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent/40 hover:text-accent ${focusRingClass}`}
              >
                清空搜索
              </button>
            </div>
          </section>
        ) : (
          <ConnectionList
            connections={filteredConnections}
            statusById={statusById}
            deletingId={deletingId}
            onCreate={openCreateForm}
            onTest={(connectionId) => {
              void testStoredConnection(connectionId);
            }}
            onEdit={openEditForm}
            onDelete={requestDeleteConnection}
          />
        )}
      </main>

      <ConnectionFormDialog
        open={formOpen}
        mode={formMode}
        initialValues={formInitialValues}
        isSaving={isSaving}
        onClose={closeForm}
        onSubmit={saveConnection}
        onDirectTest={testConnectionDirect}
      />

      <ConnectionDeleteDialog
        open={Boolean(deletingConnection)}
        connection={deletingConnection}
        isDeleting={Boolean(deletingId)}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
