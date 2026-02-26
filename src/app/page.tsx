export default function Home() {
  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-bg-secondary border border-border-default">
          <svg
            className="w-8 h-8 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 12h14M12 5l7 7-7 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-[family-name:var(--font-lexend)] font-semibold text-text-primary tracking-tight">
          FTP WebUI
        </h1>
        <p className="text-text-secondary text-sm max-w-xs mx-auto">
          运维管理面板 · 连接管理 · 文件浏览 · 在线编辑
        </p>
        <div className="flex items-center gap-2 justify-center text-xs text-text-secondary">
          <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
          系统就绪
        </div>
      </div>
    </div>
  );
}
