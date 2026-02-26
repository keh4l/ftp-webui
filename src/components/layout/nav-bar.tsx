"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Server } from "lucide-react";

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // 在 /login 页面不显示导航栏
  if (pathname === "/login") {
    return null;
  }

  const isActive = (href: string) => pathname.startsWith(href);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <nav className="border-b border-border-default bg-bg-primary">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-bg-secondary text-accent">
            <Server className="h-4 w-4" />
          </span>
          <span className="font-[family-name:var(--font-lexend)] text-lg font-semibold tracking-tight text-text-primary">
            FTP WebUI
          </span>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-4">
          <Link
            href="/connections"
            className={`text-sm font-medium transition ${
              isActive("/connections")
                ? "text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            连接管理
          </Link>

          <button
            type="button"
            id="nav-logout-btn"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-secondary px-3 py-1.5 text-xs text-text-secondary transition hover:border-red-400/40 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <LogOut className="h-3.5 w-3.5" />
            登出
          </button>
        </div>
      </div>
    </nav>
  );
}
