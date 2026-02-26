"use client";

import { useEffect } from "react";
import { RefreshCw, X } from "lucide-react";

type ConnectionsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

export default function ConnectionsError({ error, reset }: ConnectionsErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg-deep px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-red-400/40 bg-bg-primary p-6">
        <div className="inline-flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-300">
          <X className="h-4 w-4" />
          页面加载失败
        </div>

        <h2 className="mt-4 font-[family-name:var(--font-lexend)] text-2xl font-semibold text-text-primary">
          连接管理暂时不可用
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          {error.message || "发生未知错误，请稍后重试。"}
        </p>

        <button
          type="button"
          onClick={reset}
          className={`mt-6 inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent/40 hover:text-accent ${focusRingClass}`}
        >
          <RefreshCw className="h-4 w-4" />
          重新加载
        </button>
      </div>
    </div>
  );
}
