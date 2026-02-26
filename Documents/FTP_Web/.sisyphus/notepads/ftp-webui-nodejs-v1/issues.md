# Issues - FTP WebUI Node.js V1

## 2026-02-26 - T6 验收阻塞
- 本机无可用 `docker`/`docker compose`，无法执行 `docker compose up -d` 与连通性实测。
- 因此 T6 目前只能完成配置文件静态审查，无法满足“容器可连通”和“错误端口失败码”两项动态验收。

## 2026-02-26 - T18 实现过程问题（已解决）
- 问题：`src/components/files/*` 初版声明 `"use client"` 后触发 TS71007（函数 props 可序列化告警）。
- 处理：移除子组件文件的 `"use client"`，由 `src/app/files/[connectionId]/page.tsx` 作为客户端入口。
- 结果：相关告警清零，LSP diagnostics 在改动文件上为 clean。

## 2026-02-26 - 构建环境警告（未阻塞）
- Next.js 检测到工作区外层存在 `/Users/keh4l/package-lock.json`，提示 workspace root 推断警告。
- 当前不影响 `pnpm test`、`pnpm tsc --noEmit` 与 `pnpm run build` 成功，但后续建议设置 `outputFileTracingRoot` 或清理外层 lockfile 以消除噪声警告。

## 2026-02-26 - F2 质量复核结论（CONDITIONAL_PASS）
- 四项强制命令均已执行且退出码为 0：`pnpm tsc --noEmit`、`pnpm lint`、`pnpm test`、`pnpm build`。
- 测试结果：`19 pass / 0 fail`。
- 非阻塞 warning 来源：`src/lib/protocol/stubs.ts`（大量 no-unused-vars）、`src/lib/security/ssrf-guard.ts`（unused eslint-disable）、以及 workspace root warning（`/Users/keh4l/package-lock.json` 与仓库内 `pnpm-lock.yaml` 同时存在）。
- 报告已写入：`.sisyphus/evidence/f2-code-quality-review.md`。
- 2026-02-26：已修复 T6 阻塞，`docker-compose.yml` 为 `ftp` 增加 `TLS_C: "US"`，并将 `sftp` healthcheck 从 `nc -z` 改为 `pgrep -f sshd >/dev/null || exit 1`。
- 2026-02-26：将 `ftp` healthcheck 改为 `pidof pure-ftpd >/dev/null || exit 1`，并把 `start_period` 从 `15s` 提升到 `120s` 以覆盖首启证书生成时间。

## 2026-02-26 - T6 compose 启动阻塞修复（已解决）
- 根因：`ftp` 容器中的 pure-ftpd 以 qemu 进程形态运行（Apple Silicon + amd64 镜像），`pidof pure-ftpd` 健康检查出现误判，导致 `ftp` 持续 `unhealthy`，`app` 被 `depends_on: service_healthy` 阻塞。
- 改动：将 `docker-compose.yml` 中 `ftp.healthcheck.test` 调整为 PID 文件探测：`test -s /run/pure-ftpd.pid && kill -0 $(cat /run/pure-ftpd.pid) >/dev/null 2>&1 || exit 1`。
- 结果：`docker compose up -d --build` 成功拉起 `app + ftp + sftp`，`docker compose ps` 显示 `ftp/sftp` 为 `healthy`，`app` 为 `Up`。

## 2026-02-27 - /api/connections 500（better-sqlite3 binding 缺失）修复
- 根因：pnpm v10 默认拦截构建脚本，Docker 构建日志出现 `Ignored build scripts: better-sqlite3 ...`，导致 native binding 未产出，运行时报 `Could not locate the bindings file ... better_sqlite3.node`。
- 修改：在 `package.json` 增加 `pnpm.onlyBuiltDependencies`（`better-sqlite3`、`cpu-features`、`ssh2`），并保留 Dockerfile 中 deps 阶段编译工具 + `pnpm rebuild better-sqlite3` 与 runner 阶段复制 `node_modules` 的修复。
- 验证：`docker compose up -d --build` 成功，且构建日志不再将 `better-sqlite3` 列为 ignored build scripts；`curl -sS -i http://localhost:3000/api/connections` 返回 `HTTP/1.1 200 OK`，响应体为 `[]`。
