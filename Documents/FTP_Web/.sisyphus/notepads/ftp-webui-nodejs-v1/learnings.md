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


## T6 - Docker 测试环境搭建 (2026-02-26)

### Docker 镜像选择
- FTP/FTPS: `stilliard/pure-ftpd:latest` — 支持 FTP + FTPS (STARTTLS)，通过 `--tls=1` 启用可选 TLS
- SFTP: `atmoz/sftp:latest` — 轻量 OpenSSH SFTP 服务器，通过 command 参数配置用户

### 端口映射方案
- FTP 控制端口: 21:21
- FTP 被动模式端口: 21100-21110:21100-21110（11 个端口，足够 10-20 并发连接）
- SFTP: 2222:22（避免与宿主机 SSH 冲突）
- App: 3000:3000

### 测试凭据（仅在 docker-compose.yml 中）
- FTP: ftpuser / ftppass123 / /home/ftpuser
- SFTP: sftpuser / sftppass123 / /home/sftpuser/upload

### Docker 配置注意事项
- Dockerfile 使用多阶段构建（deps -> build -> runner），需要 `next.config.ts` 中设置 `output: "standalone"`
- 已修改 `next.config.ts` 添加 standalone 输出配置
- Pure-FTPd 的 `PUBLICHOST` 在容器网络中应设为服务名 "ftp"，而非 localhost
- atmoz/sftp 的用户配置格式: `user:password:uid:gid:directories`
- healthcheck 使用 `nc -z` 检测端口可用性，start_period=15s 给服务启动时间
- pnpm 版本固定为 10.30.1（与 package.json packageManager 一致）
- 开发机无 docker，compose 语法验证跳过，已保存文件内容作为证据


## T2 - 依赖与工程规范基线 (2026-02-26)

### 安装的依赖版本
核心依赖:
- basic-ftp: 5.2.0
- better-sqlite3: 12.6.2
- lucide-react: 0.575.0
- pino: 10.3.1
- pino-pretty: 13.1.3
- ssh2: 1.17.0
- ssh2-sftp-client: 12.0.1
- zod: 4.3.6

开发依赖:
- eslint: 9.39.3
- eslint-config-next: 16.1.6
- @eslint/eslintrc: 3.3.4
- @types/better-sqlite3: 7.6.13
- @types/ssh2: 1.15.5
- @types/ssh2-sftp-client: 9.0.6

### ESLint 配置方式
- 使用 flat config (`eslint.config.mjs`)，非 legacy `.eslintrc`
- eslint-config-next v16 原生导出 flat config 数组，直接 spread 即可，不需要 FlatCompat
- 导入方式: `import nextConfig from "eslint-config-next"` + `/core-web-vitals` + `/typescript`
- `next lint` 在 Next.js 15.5 中已标记 deprecated，16 将移除，建议后续迁移到 ESLint CLI

### 兼容性注意事项
- ESLint 10 与 eslint-config-next 16 的插件有 peer dep 冲突，必须使用 ESLint 9.x
- zod v4 使用 `import { z } from "zod/v4"` 导入，`z.prettifyError()` 可格式化错误
- better-sqlite3、cpu-features、ssh2、sharp 需要原生编译，通过 `pnpm.onlyBuiltDependencies` 配置白名单
- sharp 编译可能超时但不影响 Next.js 构建（Next.js 自带 sharp 处理）
- env.ts 使用 zod/v4 的 safeParse + prettifyError 做环境变量校验

## T2 复核补充 - 启动期环境校验 (2026-02-26)

### 复核结论
- 仅有 `src/lib/env.ts` 定义校验不足以证明“应用启动即失败”，必须从启动路径导入触发。
- 在 `src/app/layout.tsx` 中引入 `@/lib/env` 后，`pnpm build` 阶段会强制执行校验。

### 验证结果
- `pnpm lint` 通过。
- `pnpm typecheck` 通过。
- `pnpm build`（正常环境）通过。
- `APP_MASTER_KEY= pnpm build` 明确失败，并出现 `APP_MASTER_KEY must not be empty`。

### 额外发现
- 当前仓库尚未定义 `test` script，`pnpm run test` 会报 `ERR_PNPM_NO_SCRIPT`。


## T2 补充 - 启动路径环境变量校验 (2026-02-26)

### 问题
- `src/lib/env.ts` 有 zod v4 校验逻辑，但没有被任何启动路径文件导入
- 模块级 `export const env = validateEnv()` 只在被 import 时才执行，不会自动运行
- 之前的证据仅用 `node --import` 直接执行 env.ts，不能证明"应用启动即阻止"

### 修复
- 在 `src/app/layout.tsx` 添加 `import "@/lib/env"` (side-effect import)
- Next.js 渲染任何页面都会加载 layout.tsx → 触发 env.ts 模块执行 → validateEnv() 运行
- 缺失 APP_MASTER_KEY 时 `pnpm build` 在 "Collecting page data" 阶段即失败

### 关键发现
- Next.js 的 side-effect import 在 layout.tsx 中是确保服务端启动校验的最简方式
- `pnpm build` 比 `pnpm dev` 更适合做证据验证，因为 build 是确定性的、一次性的
- 错误信息清晰包含 `APP_MASTER_KEY must not be empty` 和 `Missing or invalid: APP_MASTER_KEY`

## T3 - 连接模型与 SQLite 持久化骨架 (2026-02-26)

### 新增模块
- `src/lib/connection/model.ts`: 定义连接实体与输入模型，字段包含 protocol/host/port/username/encryptedSecret/label/createdAt/updatedAt。
- `src/lib/connection/repository.ts`: 定义最小仓储接口 `init/create/list`。
- `src/lib/connection/sqlite-connection-repository.ts`: 基于 better-sqlite3 的默认 SQLite 实现。
- `src/lib/db/sqlite.ts`: SQLite 数据库创建与默认路径（`/.data/ftp-webui.sqlite`）封装。

### 持久化约束
- 表结构只存 `encrypted_secret`，不包含 `password` 或 `secret` 明文字段。
- `protocol` 通过 SQLite `CHECK` 约束固定为 `ftp|ftps|sftp`。
- `create` 使用 `randomUUID()` 生成 id，`created_at/updated_at` 统一写入 ISO 时间字符串。

### 验证方式
- 使用 Node 脚本对编译后的模块执行 `init -> create -> list` 闭环。
- 证据文件：
  - `.sisyphus/evidence/task-3-persistence.json`
  - `.sisyphus/evidence/task-3-no-plaintext.txt`
- 通过读取 SQLite 原始文件二进制内容验证示例明文 `SuperSecret#123` 未落盘（`plaintextFoundInDbFile=false`）。


## T4 - 凭据加密与密钥加载模块 (2026-02-26)

### 关键实现
- 使用 Node.js `crypto` 内置 AES-256-GCM，统一密文格式为 `v1:iv:authTag:ciphertext`（各段 base64）。
- 密钥从 `APP_MASTER_KEY` 通过 `scryptSync(masterKey, salt, 32)` 派生，避免任何明文 fallback。
- 解密流程分层错误类型：密钥缺失、密文损坏、版本不匹配、认证失败（`CRYPTO_DECRYPT_FAILED`）。

### 实践要点
- GCM 推荐参数：随机 IV 12 bytes、AuthTag 16 bytes；解密前先校验格式和段长度可更早识别脏数据。
- Base64 仅靠 `Buffer.from(..., "base64")` 不够严格，增加 canonical 校验可降低静默容错带来的误判。

## T5 - 协议统一契约与桩实现 (2026-02-26)

### 关键发现
- 通过 `ProtocolAdapter` 统一 connect/disconnect/testConnection/list/upload/download/readText/writeText/rename/delete/mkdir/stat 后，UI 层可只依赖公共契约，无需硬编码 FTP/SFTP 差异。
- 使用 `extensions?: Record<string, unknown>` 作为透传扩展字段，可容纳协议特有能力而不污染公共接口。
- TypeScript 接口约束可直接用于回归校验：删除任一必需方法会触发 `TS2420`，可作为契约完整性证据。


## T7 - 错误模型与日志脱敏规范 (2026-02-26)

### 错误模型
- 新增 `src/lib/errors.ts`，提供 `AppError`（`code`/`message`/`statusCode`/`details`）并继承 `Error`。
- `AppError.toJSON()` 统一输出 `{ error: { code, message, details? } }`，可直接用于 API 响应。
- 建立 `ERROR_HTTP_STATUS` 映射：
  - 400: `VALIDATION_ERROR` / `INVALID_PATH` / `FILE_TOO_LARGE`
  - 401: `AUTH_FAILED`
  - 403: `TARGET_NOT_ALLOWED` / `TLS_VALIDATION_FAILED` / `HOST_KEY_MISMATCH`
  - 404: `CONNECTION_NOT_FOUND`
  - 408: `CONNECTION_TIMEOUT`
  - 409: `FILE_VERSION_CONFLICT` / `STALE_TARGET`
  - 429: `RETRY_EXHAUSTED`
  - 500: `CRYPTO_DECRYPT_FAILED`
- 提供统一错误工厂函数：`connectionNotFound`、`authFailed`、`invalidPath`、`cryptoDecryptFailed`、`validationError`、`targetNotAllowed`、`fileTooLarge`、`fileVersionConflict`、`tlsValidationFailed`、`hostKeyMismatch`、`retryExhausted`、`staleTarget`。

### 日志规范与脱敏
- 新增 `src/lib/logger.ts`，基于 pino 输出结构化日志；`NODE_ENV !== "production"` 时启用 `pino-pretty`。
- 使用 `redact` 自动脱敏字段：`password`、`secret`、`privateKey`、`token`、`encryptedSecret`、`authorization` 及其一级嵌套同名字段。
- 脱敏统一替换为 `[REDACTED]`，避免原始凭据或密文写入日志。
- 增加 `maskCipherPreview()` 辅助函数，只保留密文前 8 位并追加 `...`。

### 证据与验证
- 证据文件：
  - `.sisyphus/evidence/task-7-error-format.json`
  - `.sisyphus/evidence/task-7-log-redaction.txt`
- `task-7-log-redaction.txt` 中已验证明文字段未出现（日志输出均为 `[REDACTED]`）。
- `pnpm typecheck` 当前被既有文件 `src/lib/protocol/stubs.ts` 的接口实现问题阻塞（非本次 T7 改动引入）。
- `APP_MASTER_KEY=test-key-for-build pnpm build` 通过。

## T9 - SFTP 适配器实现 (2026-02-26)

### 关键发现
- 在 ssh2/ssh2-sftp-client 中，若不显式提供 hostVerifier 会导致主机密钥校验策略不明确；本次实现默认 strictHostKey=true，并要求提供 hostFingerprint，只有 extensions.strictHostKey=false 才允许放宽并写告警日志。
- `readText` 先走 `stat` 做 `maxSize` 预检可以在下载前阻断大文件，避免不必要的网络与内存占用。
- 文本读写的 etag 使用 `md5(modifiedAt:size)`，`writeText` 在写入前先比对 etag，不一致统一抛 `fileVersionConflict`。
- 上传支持 `put` 与可选 `fastPut`（通过 `opts.extensions.useFastPut`），并补充了 `fastGet/fastPut` 方法用于大文件场景。

## T11 - 连接池、超时与指数退避重试 (2026-02-26)

### 关键发现
- 连接池在 Map<string, PoolEntry> 下通过 busy/idle 状态即可满足 FTP 单连接串行约束；池满时采用等待队列 + 获取超时可避免直接拒绝。
- 对等待队列做可满足项扫描可避免队头阻塞：若某连接仍 busy，不会阻塞其他可立即创建或复用的连接请求。
- 指数退避采用 min(baseDelay * multiplier^retryIndex, maxDelay) 后叠加 ±20% 抖动，可降低并发失败时重试雪崩。
- isRetryable 需显式排除 RETRY_EXHAUSTED，否则会出现对重试耗尽错误再次重试的自循环。
- withTimeout 用 AbortController + Promise.race 可统一抛出 CONNECTION_TIMEOUT，并与重试策略形成可观测的 timeout 计数。

## T8 - FTP/FTPS 适配器实现 (2026-02-26)

### 关键实现
- 新增 src/lib/protocol/ftp-adapter.ts，完成 ProtocolAdapter 全量 12 个方法，覆盖连接、列表、传输、文本读写、目录与元信息操作。
- FTPS 连接使用 secure=true 与 secureOptions.rejectUnauthorized，默认严格校验，仅在 extensions.insecure=true 时关闭并记录警告日志。
- 目录列表使用 basic-ftp FileInfo 到 FileEntry 的固定映射（type/modifiedAt/permissions），并在路径层做规范化与非法段拦截。

### 行为策略
- 重连封装：对网络中断/超时类错误进行有限重连（默认 1 次，可扩展配置），认证/路径类错误不重连。
- 编码 fallback：支持 extensions.encoding 与 extensions.encodingFallbacks，列表/读文本出现编码相关异常时自动切换下一个编码重试。
- 文本编辑冲突控制：writeText 先 stat 计算 etag（md5(mtime+":"+size)），不匹配抛出 FILE_VERSION_CONFLICT。

### 验证
- pnpm typecheck 通过，证据已写入 .sisyphus/evidence/task-8-typecheck.txt。

## T13 - 统一上传下载服务 (2026-02-26)

### 关键发现
- `TransferService` 保持流式语义：上传直接透传 `string|Buffer|Readable` 给适配器，下载返回 `Readable` 并通过 `data/end/error` 事件追踪进度与状态，不做全量内存缓存。
- 在 `path-utils` 尚未可用时，先做最小内联校验（NUL 字符、`..` 段、路径规范化），可提前阻断明显非法路径并复用 `invalidPath` 错误语义。
- 统一 `TransferStatus`（pending/transferring/completed/failed）+ `Map` 状态表后，可将协议侧进度回调标准化到服务层，便于后续扩展订阅机制。
- `maxFileSize` 对 `Buffer` 源在传输前做拦截，避免大块内存对象直接进入网络发送路径。

## T12 - 文件浏览服务与路径安全 (2026-02-26)

### 关键发现
- 浏览服务层必须独立执行路径安全校验，不能仅依赖 FTP/SFTP 适配器内部逻辑，否则跨协议行为容易不一致。
- 路径规范化先做输入清洗（trim、反斜杠转斜杠），再做 `path.posix.normalize`，最后统一校验 `..` 与 null 字节，能更稳定拦截穿越路径。
- FTP/SFTP 列表结果存在目录项差异，服务层过滤 `.`/`..` 并统一元信息格式后，前端可直接消费统一 `FileEntry[]`。
- `stat` 返回值也要做同样的字段标准化（type/size/modifiedAt/permissions），否则不同适配器会出现可见行为差异。
- `pnpm typecheck` 在当前改动下通过，证据文件：`.sisyphus/evidence/task-12-typecheck.txt`。

## T14 - 在线文本编辑服务 (2026-02-26)

### 关键发现
- 编辑服务层要在调用 `adapter.readText` 前先执行一次 `stat` 大小检查，才能统一抛出 `fileTooLarge(size, limit)` 并避免下载大文件。
- 并发覆盖控制应透传 `etag` 给 `adapter.writeText`；冲突比较逻辑放在适配器内部，服务层只负责参数传递与操作日志。
- `isEditable` 使用“大小阈值 + 扩展名白名单”双判定最直接，配合 `type === "file"` 可拒绝目录/链接等非文本目标。
- 路径安全在服务层做轻量前置校验（拒绝 `..` 与 null 字节）可提前阻断明显非法请求，减少下游协议调用成本。

### 产出
- 新增 `src/lib/file/edit-service.ts`，包含 `readText/writeText/isEditable`、`EditOptions/SaveOptions/EditableCheck`、`DEFAULT_MAX_EDIT_SIZE` 和 `EDITABLE_EXTENSIONS`。
- `pnpm typecheck` 通过，证据文件：`.sisyphus/evidence/task-14-typecheck.txt`。

## T13 - 统一上传下载服务（补记）(2026-02-26)

### 关键发现
- 上传通过适配器 `onProgress` 回调回填状态表，下载通过流事件累计字节，满足基础进度追踪且不做大文件全量内存读取。
- `TransferService` 构造函数仅依赖 `resolveAdapter(connectionId)`，可与连接池/连接管理层解耦。

## T10 - 连接管理服务 (2026-02-26)

### 关键实现
- `ConnectionService` 封装完整 CRUD + 测试连接能力，所有对外返回使用 `ConnectionView` 类型，不含 `encryptedSecret`，仅展示 `maskedSecret: "****"`。
- `ConnectionInput` 接收明文 `password`，`createConnection` 和 `updateConnection` 内部调用 `encrypt()` 后存储。
- `testConnection(id)` 从仓储取连接 → `decrypt(encryptedSecret)` → 根据 protocol 创建 FtpAdapter/SftpAdapter → 调用 `adapter.testConnection(config)` → 返回 `TestResult`。
- `testConnectionDirect(input)` 直接用输入明文密码测试，不持久化。

### 仓储扩展
- `SqliteConnectionRepository` 新增 `findById(id)`、`update(id, data)`、`remove(id)` 三个方法，支持动态 SET 子句构建。
- 定义 `ConnectionServiceRepository` 类型 = `ConnectionRepository & { findById, update, remove }`，服务层依赖此扩展接口。

### 适配器工厂
- 根据 `protocol` 字段选择适配器：`ftp/ftps` → `FtpAdapter`，`sftp` → `SftpAdapter`，其他抛 `validationError`。
- 适配器实例为一次性使用（testConnection 内部创建并销毁），不复用。

### 关键发现
- `ConnectionRepository` 接口（repository.ts）只有 `init/create/list`，不够支撑完整 CRUD；通过在 service.ts 定义 `ConnectionServiceRepository` 交叉类型扩展，避免修改原始接口文件。
- `encrypt/decrypt` 函数内部自动从 `APP_MASTER_KEY` 派生密钥，服务层无需手动管理密钥。
- pnpm typecheck 零错误通过。

## T16 - 文件操作 API（浏览/传输/编辑/批量）(2026-02-26)

### 关键发现
- 文件路由层统一使用 `zod/v4` + `z.prettifyError()` 转换为 `validationError`，可在参数缺失、JSON 非法、multipart 字段不匹配时保持一致错误结构。
- `resolveAdapter(connectionId)` 需要直接从仓储读取 `encryptedSecret` 并 `decrypt` 后再实例化 `FtpAdapter/SftpAdapter`，仅依赖 `ConnectionService.getConnection()` 无法拿到明文凭据。
- 下载接口在 Node 运行时可通过 `Readable.toWeb()` 将 Node 流转换为 Web Stream，再用 `new Response(stream, { headers })` 返回附件。
- 批量删除采用 best-effort：逐项 `validatePath + adapter.delete`，单项失败写入 `{ path, success: false, error }`，整体保持 200 返回，避免 all-or-nothing 语义。
- 对 `path` 查询参数统一做非空校验，穿越路径由服务层/`validatePath` 触发 `INVALID_PATH`，满足路径安全约束。

## T15 - 连接管理 API（REST）(2026-02-26)

### 关键发现
- 在 Next.js App Router 的 API 层复用 `handleApiError()` + `getConnectionService()` 能统一错误结构与服务初始化，避免每个路由重复构造仓储与状态码映射逻辑。
- zod v4 建议统一走 `safeParse` + `z.prettifyError()`，再封装为 `validationError(...)`，可保持所有 400 错误都输出 `AppError.toJSON()` 结构。
- `ConnectionService` 返回的 `ConnectionView` 已天然屏蔽敏感字段（仅 `maskedSecret`），API 层直接返回服务结果即可避免明文或密文字段泄露。
- DELETE 204 在 App Router 中可通过 `NextResponse.json(undefined, { status: 204 })` 保持接口风格统一，同时避免返回敏感内容。
- 本次新增四组连接路由（list/create、detail/update/delete、existing-test、direct-test）后，`pnpm typecheck` 仍保持零错误。

## T20 - 安全加固：SSRF 防护、审计日志、路径安全确认 (2026-02-26)

### SSRF 防护
- 使用 Node.js 内置 `net.isIP()` 判断直接 IP，`dns.promises.Resolver` 解析域名后检查所有返回 IP。
- IPv4 私网段检查通过 CIDR 转整数掩码比较实现：127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0/8。
- IPv6 检查覆盖 ::1（环回）、fc00::/7（唯一本地）、fe80::/10（链路本地），通过手动展开 :: 并检查首字节前缀实现。
- `ALLOW_PRIVATE_NETWORKS=true` 环境变量跳过检查（开发环境用），默认不允许。
- DNS 解析失败时放行（连接会自然失败），避免 DNS 不可用导致所有连接被拒。
- SSRF 检查集成在 `ConnectionService` 的 `createConnection`、`updateConnection`（仅 host 变更时）、`testConnectionDirect` 三个入口。
- `testConnection(id)` 不需要 SSRF 检查，因为 host 在创建/更新时已校验。

### 审计日志
- 使用 pino `logger.child({ module: "audit" })` 创建专用审计子实例，继承主 logger 的 redact 配置。
- 审计字段：action, target, result(success/failure), error?，target 经过 `stripSensitive` 过滤敏感键。
- 覆盖操作：connection.create, connection.update, connection.delete, connection.test, file.batch_delete。
- 敏感字段黑名单：password, privateKey, encryptedSecret, secret, token, authorization。

### 路径安全确认
- `batch/route.ts` 直接调用 `validatePath`。
- `browse-service` 使用 `normalizePath`（与 `validatePath` 等价）。
- `transfer-service` 有独立的 `normalizeAndValidateRemotePath` 内联校验。
- `edit-service` 有独立的内联路径校验（拒绝 null 字节和 `..`）。
- 所有文件操作路径均已覆盖，无遗漏。

### 关键发现
- `createConnection` 和 `updateConnection` 因 SSRF 检查（DNS 解析）从同步变为 async，API 路由层需要 `await`。
- `TestResult.error` 是 `ProtocolError` 类型（含 `message` 字段），不是直接的 `message` 属性，审计日志中需用 `result.error?.message`。
- 不需要修改 `env.ts` 添加 `ALLOW_PRIVATE_NETWORKS`，因为它是可选的运行时环境变量，直接通过 `process.env` 读取即可，无需 zod 强制校验。
- `pnpm tsc --noEmit` 零错误通过。

## T17 - WebUI 连接管理页面 (2026-02-26)

### 关键发现
- 在 App Router 中，`/app/connections/page.tsx` 作为唯一客户端边界（`"use client"`）更稳妥；子组件可不重复声明，避免 LSP 提示“props 必须可序列化”的噪音告警。
- 连接状态展示可用本地 `statusById` 映射管理（idle/testing/success/error），无需改动后端即可给列表按钮和状态徽标提供精细 loading/结果反馈。
- 直连测试（`POST /api/connections/test`）放入创建/编辑弹窗，保存前即可验证参数；列表中的测试按钮使用 `POST /api/connections/[id]/test` 覆盖“已保存连接”场景。
- 统一 `requestJson + parseApiError` 能稳定消费 `{ error: { code, message, details? } }` 格式，toast 与页面错误横幅可复用同一错误消息。
- 按要求补齐 `data-testid` 选择器，并在按钮/输入统一加 `focus-visible` 样式，可同时满足自动化测试和键盘可访问性。

## T18 - WebUI 文件浏览与传输页面 (2026-02-26)

### 关键发现
- Next.js 客户端边界下，子组件不必都声明 `"use client"`；由客户端页面导入即可进入客户端图。这样可避免 TS71007 对函数型 props 的序列化告警。
- 文件列表体验上优先按 `directory` 在前、名称本地化排序（`localeCompare("zh-CN", { numeric: true })`）更符合运维目录浏览预期。
- 传输反馈用 `aria-live="polite"` 的状态区 + 成功/错误轻提示，可在不引入额外依赖的情况下满足可访问性与可观测性。
- 路径输入统一走 `normalizePath`（补前导 `/`、合并重复斜杠、去末尾斜杠）可减少 API 400 并统一面包屑与手输跳转行为。
- `APP_MASTER_KEY=test-key-for-build pnpm tsc --noEmit` 在本次改动后通过。

## T19 - WebUI 在线编辑与批量操作交互 (2026-02-26)

### 关键发现
- 在线编辑页先调用 `/files/editable` 再调用 `/files/edit`，可以提前给出「不可编辑」状态，避免无效读写请求。
- `FILE_VERSION_CONFLICT` 需要单独分支处理，展示冲突警告并提供「覆盖保存 / 重新加载」操作，避免静默失败。
- 批量删除的高风险确认（>=5 项）可通过输入 `DELETE` 门槛实现，满足不可逆操作的二次保护要求。
- 批量结果面板使用逐项成功/失败数据和失败重试入口，可与 best-effort 后端语义直接对齐。

## T21 - 自动化测试补齐（单元 + 集成）(2026-02-26)

### 关键发现
- 使用 Vitest + alias(`@`) 可以直接覆盖 `src/lib/*` 单元逻辑（路径校验、加解密、SSRF guard）而无需额外构建步骤。
- API 集成测试对 App Router route handler 直接调用 `GET/POST` 即可，无需启动 HTTP server。
- 路由测试中通过 `vi.mock` 注入 `getConnectionService/getBrowseService`，可稳定验证请求校验和响应结构，不依赖真实数据库或协议连接。
- Next.js build 需要 `serverExternalPackages` 外置 `better-sqlite3/ssh2/ssh2-sftp-client/cpu-features`，否则会在打包原生 `.node` 模块时报错。

## T22 - Playwright E2E 场景 (2026-02-26)

### 关键发现
- 使用 `page.route()` 模拟连接与文件 API，可以在无 Docker 依赖服务条件下稳定执行 UI 主流程 E2E。
- 文件路由拦截应使用更精确的正则（如 `/\/api\/connections\/c1\/files\?/`），避免误匹配到 `/files/editable` 等子路由。
- 编辑冲突路径可通过首次 `PUT /edit` 返回 `FILE_VERSION_CONFLICT`、二次 `PUT` 返回成功来验证冲突提示与覆盖保存链路。
- 批量删除可通过 `file-select-all` + `batch-delete-btn` + `batch-delete-input`（DELETE）覆盖高风险确认与逐项结果展示。
- Playwright 配置开启 `trace: on-first-retry` 与 `screenshot: only-on-failure` 可自动产出失败追踪证据，满足可追溯要求。

## T23 - 并发与恢复烟测 (2026-02-26)

### 关键发现
- 使用 `ConnectionPool + withRetry + ResilienceMetrics` 可在无真实协议服务条件下构建可重复并发烟测，覆盖获取/释放连接、重试、恢复链路。
- 通过可控故障注入（短时 outage）+ 重试窗口，可以稳定验证恢复能力并导出成功率与重试统计。
- 将报告直接输出到 `.sisyphus/evidence/task-23-concurrency-report.txt` 与 `.sisyphus/evidence/task-23-recovery-report.txt`，可满足验收所需证据文件约束。

## T24 - 部署文档与回归脚本 (2026-02-26)

### 关键发现
- `scripts/ops/regression-smoke.sh` 通过健康检查 + 连接列表 + 参数校验失败路径三类低风险接口即可提供稳定的“可用性回归”基线。
- 使用 `BASE_URL` 环境变量可避免脚本绑定本地固定地址，满足可复用性约束。
- 回归失败证明可通过不可达地址（如 `127.0.0.1:3999`）执行脚本并记录非零退出码，形成可审计证据。

## F3 - Real Manual QA（Playwright 真实交互核查）(2026-02-26)

### 关键发现
- 使用 `pnpm playwright test tests/e2e/ui-flows.spec.ts` 可在单次执行中覆盖连接、文件浏览/传输、在线编辑、批量删除四条主路径，结果为 `5 passed`。
- 弹窗可访问性链路已被显式断言：`role="dialog"`、`aria-modal="true"`、`Esc` 关闭、关闭后焦点回收到 `batch-delete-btn`。
- 选择器契约满足约定：`connection-*`、`file-*`、`editor-*`、`batch-*` 均存在且 E2E 主要基于 `data-testid`，未使用 class 作为主证据。
- Edge cases 已覆盖并通过：`INVALID_PATH`、`FILE_VERSION_CONFLICT` 覆盖保存、高风险批量删除 `DELETE` 文本确认与逐项失败展示。

### 限制说明
- 当前场景通过 `page.route()` 模拟 API 响应，验证重点是 UI 真实浏览器交互行为与可访问性契约；不直接代表真实 FTP/FTPS/SFTP 网络链路稳定性。

## F1 - Plan Compliance Audit (2026-02-26)

### 审计结论
- 结构化结论：Must Have [5/5] | Must NOT Have [5/5] | Tasks [23/28] | VERDICT FAIL。
- Top-level TODO 勾选进度为 23/28；实施任务为 23/24（T6 未勾选）；Final Wave 为 0/4。

### 关键不一致
- 勾选与证据不一致：T6 未勾选但已有 `.sisyphus/evidence/task-6-compose.txt`。
- 勾选与证据不一致：F2/F3 未勾选但已有 `.sisyphus/evidence/f2-code-quality-review.md`、`.sisyphus/evidence/f3-real-manual-qa.md`。
- 按计划“Evidence to Capture”核对，24 个实施任务中有 17 个任务至少缺失 1 个声明证据（典型为 T21/T22）。

### 审计执行记录
- 已运行 `pnpm tsc --noEmit`（PASS）。
- 已执行 `ast-grep TODO`（src 下无 TODO 占位）。
- F1 报告文件：`.sisyphus/evidence/f1-plan-compliance-audit.md`。

## T-root-redirect - 根路由重定向修复 (2026-02-27)
- `src/app/page.tsx` 改为 Server Component 直接 `redirect("/connections")`，删除静态 landing JSX，确保进入 WebUI 不再停在首页占位视图。
- `pnpm typecheck` 通过，改动未引入新的 TypeScript 问题。
- `curl -sSI http://localhost:3000` 在服务可用时返回 `HTTP/1.1 307 Temporary Redirect` 且 `location: /connections`，验证重定向生效。

- 2026-02-27: 为认证中间件适配 E2E，采用 test.beforeEach + page.request.post('/api/auth/login') 登录，保持原断言不变。
- 2026-02-27: Playwright webServer 需注入 ADMIN_USERNAME=admin 与 ADMIN_PASSWORD=test-pass，否则登录 API 在测试启动时会因环境变量缺失失败。
- 2026-02-27: 本地/容器环境需显式提供 ADMIN_PASSWORD（及容器中的 ADMIN_USERNAME），与 APP_MASTER_KEY 一起满足 env 校验。
