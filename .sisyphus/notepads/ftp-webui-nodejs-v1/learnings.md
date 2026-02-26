# Learnings - FTP WebUI Node.js V1


## T1 - Next.js 项目初始化 (2026-02-26)

### 安装版本
- Next.js: 15.5.12
- React: 19.2.4
- Tailwind CSS: 4.2.1 (v4, 使用 @tailwindcss/postcss 插件)
- TypeScript: 5.9.3
- Node: v25.2.1
- pnpm: 10.30.1

### 目录结构
```
src/
  app/
    api/health/route.ts   # GET /api/health -> { status, timestamp }
    globals.css            # Tailwind v4 @import + @theme 色彩令牌
    layout.tsx             # 根布局 (dark, zh-CN, 三字体变量)
    page.tsx               # 首页占位 (暗色运维台风格)
```

### 关键发现
- Tailwind v4 不再需要 `tailwind.config.ts`，颜色令牌通过 `globals.css` 中的 `@theme {}` 块定义
- PostCSS 配置使用 `@tailwindcss/postcss` 插件（非 v3 的 tailwindcss + autoprefixer）
- `pnpm build` 成功，零 TypeScript 错误
- Next.js 15.5 检测到上级目录有 package-lock.json 会发出 workspace root 警告，不影响构建
- 字体设置：Lexend (标题) + Source Sans 3 (正文) + Noto Sans SC (中文回退)，通过 CSS 变量暴露
- 色彩令牌：bg-primary=#0F172A, bg-secondary=#1E293B, accent=#22C55E, bg-deep=#020617, text-primary=#F8FAFC
