"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Toast, type ToastItem, type ToastVariant } from "@/components/ui/toast";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type TextContent = {
  content: string;
  etag?: string;
  encoding?: string;
};

function parseErrorPayload(payload: unknown): ApiErrorResponse["error"] {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return undefined;
  }
  const maybeError = (payload as ApiErrorResponse).error;
  if (!maybeError || typeof maybeError !== "object") {
    return undefined;
  }
  return maybeError;
}

export default function FileEditPage() {
  const params = useParams<{ connectionId: string }>();
  const searchParams = useSearchParams();
  const connectionId = typeof params.connectionId === "string" ? params.connectionId : "";
  const filePath = searchParams.get("path") ?? "";

  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [etag, setEtag] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [conflict, setConflict] = useState(false);
  const [notEditable, setNotEditable] = useState<string | null>(null);

  const pushToast = useCallback((variant: ToastVariant, title: string, description?: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, variant, title, description }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const hasUnsavedChanges = content !== savedContent;
  const lineCount = content.length === 0 ? 1 : content.split(/\r\n|\r|\n/).length;
  const characterCount = content.length;

  const confirmDiscardChanges = useCallback(() => {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm("当前有未保存的修改，确定离开当前页面吗？");
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      if (link.target && link.target !== "_self") {
        return;
      }

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        return;
      }

      const nextUrl = new URL(link.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const isSameLocation =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash;

      if (isSameLocation || confirmDiscardChanges()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [confirmDiscardChanges, hasUnsavedChanges]);

  const loadContent = useCallback(async () => {
    if (!connectionId || !filePath) return;
    setIsLoading(true);
    setConflict(false);
    setNotEditable(null);

    try {
      // Check editability first
      const checkRes = await fetch(
        `/api/connections/${encodeURIComponent(connectionId)}/files/editable?path=${encodeURIComponent(filePath)}`,
      );
      const checkPayload = (await checkRes.json()) as { editable?: boolean; reason?: string };
      if (!checkRes.ok || !checkPayload.editable) {
        setNotEditable(checkPayload.reason ?? "此文件不可编辑");
        setIsLoading(false);
        return;
      }

      // Load content
      const res = await fetch(
        `/api/connections/${encodeURIComponent(connectionId)}/files/edit?path=${encodeURIComponent(filePath)}`,
      );
      const payload = (await res.json()) as unknown;

      if (!res.ok) {
        const apiError = parseErrorPayload(payload);
        throw new Error(apiError?.message ?? "加载文件内容失败");
      }

      const textContent = payload as TextContent;
      setContent(textContent.content ?? "");
      setSavedContent(textContent.content ?? "");
      setEtag(textContent.etag);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载文件内容失败";
      pushToast("error", "加载文件内容失败", message);
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, filePath, pushToast]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const handleSave = useCallback(
    async (forceOverwrite?: boolean) => {
      if (!connectionId || !filePath) return;
      setIsSaving(true);
      setConflict(false);

      try {
        const body: Record<string, string> = { path: filePath, content };
        if (!forceOverwrite && etag) {
          body.etag = etag;
        }

        const res = await fetch(
          `/api/connections/${encodeURIComponent(connectionId)}/files/edit`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );

        const payload = (await res.json()) as unknown;

        if (!res.ok) {
          const apiError = parseErrorPayload(payload);
          if (apiError?.code === "FILE_VERSION_CONFLICT") {
            setConflict(true);
            return;
          }
          throw new Error(apiError?.message ?? "保存失败");
        }

        pushToast("success", "文件已保存");
        // Reload to get fresh etag
        await loadContent();
      } catch (error) {
        const message = error instanceof Error ? error.message : "保存失败";
        pushToast("error", "保存失败", message);
      } finally {
        setIsSaving(false);
      }
    },
    [connectionId, filePath, content, etag, loadContent, pushToast],
  );

  useEffect(() => {
    if (notEditable) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();

        if (!isLoading && !isSaving) {
          void handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, isLoading, isSaving, notEditable]);

  const editorStatusLabel = isSaving ? "保存中..." : hasUnsavedChanges ? "未保存修改" : "已同步";
  const editorStatusClass = isSaving
    ? "border-accent/30 bg-accent/10 text-accent"
    : hasUnsavedChanges
      ? "border-yellow-400/40 bg-yellow-500/10 text-yellow-100"
      : "border-border-default bg-bg-secondary text-text-secondary";

  if (!filePath) {
    return (
      <main className="min-h-screen bg-bg-deep px-4 py-10 text-text-primary md:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border-default bg-bg-secondary/70 p-8 text-center">
          <h1 className="text-2xl font-[family-name:var(--font-lexend)] font-semibold tracking-tight">
            缺少文件路径
          </h1>
          <p className="mt-3 text-text-secondary">请从文件浏览页选择要编辑的文件。</p>
          <div className="mt-6 flex justify-center">
            <Link
              href={`/files/${encodeURIComponent(connectionId)}`}
              className="inline-flex items-center gap-2 rounded-md border border-border-default px-4 py-2 text-sm text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              data-testid="editor-back-btn"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回文件浏览
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-deep px-4 py-6 text-text-primary md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-[family-name:var(--font-lexend)] font-semibold tracking-tight">
              在线编辑
            </h1>
            <p className="text-sm text-text-secondary">{filePath}</p>
          </div>
          <Link
            href={`/files/${encodeURIComponent(connectionId)}`}
            className="inline-flex items-center gap-2 rounded-md border border-border-default px-4 py-2 text-sm text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="editor-back-btn"
            onClick={(event) => {
              if (!confirmDiscardChanges()) {
                event.preventDefault();
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回
          </Link>
        </header>

        {conflict ? (
          <div
            className="rounded-md border border-yellow-400/60 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100"
            role="alert"
            aria-live="assertive"
            data-testid="editor-conflict-warning"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>文件已被其他操作修改，版本冲突。</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-yellow-400/60 px-3 py-1.5 text-xs text-yellow-100 transition hover:bg-yellow-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => void handleSave(true)}
                disabled={isSaving}
              >
                覆盖保存
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-border-default px-3 py-1.5 text-xs text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => void loadContent()}
                disabled={isLoading}
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                重新加载
              </button>
            </div>
          </div>
        ) : null}

        {notEditable ? (
          <div className="rounded-md border border-red-400/60 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            此文件不可编辑：{notEditable}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-text-secondary">
            加载中...
          </div>
        ) : notEditable ? null : (
          <section className="overflow-hidden rounded-2xl border border-border-default bg-bg-primary">
            <div className="flex flex-col gap-3 border-b border-border-default px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 ${editorStatusClass}`}>{editorStatusLabel}</span>
                <span className="rounded-full border border-border-default bg-bg-secondary px-2.5 py-1 text-text-secondary">
                  {lineCount} 行
                </span>
                <span className="rounded-full border border-border-default bg-bg-secondary px-2.5 py-1 text-text-secondary">
                  {characterCount} 字符
                </span>
                <span className="rounded-full border border-border-default bg-bg-secondary px-2.5 py-1 text-text-secondary">
                  快捷键 ⌘/Ctrl+S
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() => void handleSave()}
                  disabled={isSaving || isLoading || !hasUnsavedChanges}
                  data-testid="editor-save-btn"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {isSaving ? "保存中..." : hasUnsavedChanges ? "保存" : "已保存"}
                </button>
              </div>
            </div>

            <textarea
              className="min-h-[480px] w-full resize-y bg-transparent px-4 py-4 font-mono text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none"
              style={{ fontFamily: "var(--font-fira-code, monospace)" }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSaving}
              data-testid="editor-textarea"
              spellCheck={false}
            />
          </section>
        )}

        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    </main>
  );
}
