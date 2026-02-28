# FTP WebUI

一个基于 **Next.js 15 + TypeScript** 的 FTP/SFTP Web 管理界面。  
用于在浏览器里完成连接管理、文件浏览与编辑、上传下载、批量操作等日常运维任务。

## 功能特性

- 支持协议：**FTP / FTPS / SFTP**
- 连接管理：新增、测试、编辑、删除连接
- 文件管理：
  - 目录浏览、返回上级、路径跳转
  - 文件下载、上传
  - 文本文件在线编辑
  - 新建文件 / 新建文件夹
  - 批量删除
  - 拖拽移动（支持多选后批量移动）
- 安全与审计：
  - 管理员登录会话
  - 连接凭据加密存储（`APP_MASTER_KEY`）
  - SSRF 防护与审计日志

## 技术栈

- Next.js (App Router)
- React 19
- TypeScript
- pnpm
- SQLite（`better-sqlite3`）
- `basic-ftp` / `ssh2-sftp-client`

## 本地开发

### 1) 安装依赖

```bash
pnpm install
```

### 2) 配置环境变量

复制示例文件并修改：

```bash
cp .env.example .env.local
```

`.env.local` 至少需要：

```bash
APP_MASTER_KEY=your-secret-key-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-admin-password
```

> `APP_MASTER_KEY` 用于加密连接凭据，生产环境请使用高强度随机值。

### 3) 启动开发服务

```bash
pnpm dev
```

打开：`http://localhost:3000`

## 质量检查

```bash
pnpm typecheck
pnpm test
pnpm run build
```

## Docker 部署

```bash
docker compose up -d --build
docker compose ps
```

健康检查：

```bash
curl -fsS http://localhost:3000/api/health
```

更完整的部署/回归/备份说明见：`docs/docker-runbook.md`

## 项目目录

```text
src/
  app/                  # 页面与 API 路由
  components/           # UI 组件（连接管理、文件管理）
  lib/                  # 业务逻辑（连接、协议适配器、安全、文件服务）
tests/
  unit/                 # 单元测试
  integration/          # 接口集成测试
  runtime/              # 运行时烟测
docs/
  docker-runbook.md     # 部署运维手册
```

## 说明

- `.sisyphus/`、`.omc/`、`.opencode/` 等本地代理/流程产物已在 `.gitignore` 中排除。
