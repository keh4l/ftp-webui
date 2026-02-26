"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Lock, Server } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.error?.message || "登录失败";
        setError(message);
        return;
      }

      router.push("/connections");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const focusRingClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-deep px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border-default bg-bg-secondary text-accent">
            <Server className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-[family-name:var(--font-lexend)] text-2xl font-semibold tracking-tight text-text-primary">
            FTP WebUI
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            FTP/SFTP 运维管理面板
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border-default bg-bg-primary p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-text-secondary" />
            <h2 className="text-sm font-medium text-text-secondary">管理员登录</h2>
          </div>

          {error && (
            <div
              className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2.5 text-sm text-red-300"
              data-testid="login-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-sm font-medium text-text-secondary">
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              data-testid="login-username"
              className={`w-full rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 transition hover:border-accent/40 ${focusRingClass}`}
              placeholder="请输入用户名"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              data-testid="login-password"
              className={`w-full rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 transition hover:border-accent/40 ${focusRingClass}`}
              placeholder="请输入密码"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            data-testid="login-submit"
            className={`w-full rounded-lg border border-accent/40 bg-accent/15 px-4 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                登录中...
              </span>
            ) : (
              "登录"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
