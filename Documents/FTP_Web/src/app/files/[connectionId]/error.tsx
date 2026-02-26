"use client";

import Link from "next/link";
import { useEffect } from "react";

type FileBrowserErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function FileBrowserError({ error, reset }: FileBrowserErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-bg-deep px-4 py-10 text-text-primary md:px-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border-default bg-bg-secondary/70 p-8 text-center">
        <h1 className="text-2xl font-[family-name:var(--font-lexend)] font-semibold tracking-tight">
          文件页面发生错误
        </h1>
        <p className="mt-3 text-sm text-text-secondary">{error.message || "请稍后重试或返回连接列表"}</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-border-default px-4 py-2 text-sm text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            重试
          </button>
          <Link
            href="/connections"
            className="rounded-md border border-border-default px-4 py-2 text-sm text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            返回连接页
          </Link>
        </div>
      </div>
    </main>
  );
}
