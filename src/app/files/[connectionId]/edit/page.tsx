"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
  const [etag, setEtag] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notEditable, setNotEditable] = useState<string | null>(null);

  const clearToasts = useCallback(() => {
    setErrorToast(null);
    setSuccessToast(null);
  }, []);

  useEffect(() => {
    if (!errorToast && !successToast) return;
    const timer = window.setTimeout(() => clearToasts(), 3200);
    return () => window.clearTimeout(timer);
  }, [clearToasts, errorToast, successToast]);

  const loadContent = useCallback(async () => {
    if (!connectionId || !filePath) return;
    setIsLoading(true);
    setConflict(false);
    setNotEditable(null);
    clearToasts();

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
      setEtag(textContent.etag);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载文件内容失败";
      setErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  }, [connectionId, filePath, clearToasts]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const handleSave = useCallback(
    async (forceOverwrite?: boolean) => {
      if (!connectionId || !filePath) return;
      setIsSaving(true);
      setConflict(false);
      clearToasts();

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

        setSuccessToast("文件已保存");
        // Reload to get fresh etag
        await loadContent();
      } catch (error) {
        const message = error instanceof Error ? error.message : "保存失败";
        setErrorToast(message);
      } finally {
        setIsSaving(false);
      }
    },
    [connectionId, filePath, content, etag, clearToasts, loadContent],
  );

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
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回
          </Link>
        </header>

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
          <>
            <textarea
              className="min-h-[400px] w-full rounded-md border border-border-default bg-bg-primary px-4 py-3 font-mono text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ fontFamily: "var(--font-fira-code, monospace)" }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSaving}
              data-testid="editor-textarea"
              spellCheck={false}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => void handleSave()}
                disabled={isSaving || isLoading}
                data-testid="editor-save-btn"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {isSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
