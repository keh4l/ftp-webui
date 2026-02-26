# FTP WebUI Node.js V1 Work Plan

## TL;DR

> **Quick Summary**: 构建一个基于 Next.js 的单管理员 FTP/FTPS/SFTP Web 管理工具，支持连接管理与远程文件操作，并以安全与可验证交付为优先。
>
> **Deliverables**:
> - Next.js 单体应用（API + WebUI）
> - 协议适配层（FTP/FTPS/SFTP）
> - 连接管理、文件浏览、上传下载、在线编辑、批量操作
> - Docker 单机部署与自动化验证
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves + final verification wave
> **Critical Path**: T1 -> T5 -> T10 -> T16 -> T21 -> F1-F4

---

## Context

### Original Request
使用 Node.js 开发在线 FTP 连接管理工具（WebUI 操作）。

### Interview Summary
**Key Discussions**:
- 协议范围确定为 FTP + FTPS + SFTP。
- 用户模型确定为单管理员（V1）。
- V1 功能确定为连接增删改测、文件浏览、上传下载、在线编辑、批量操作。
- 部署目标确定为 Docker 单机。
- 架构路线确定为 Next.js 一体化。
- 凭据策略确定为加密落库 + 环境密钥。
- 目标并发确定为 10-20 活跃连接。
- 测试策略确定为“先实现后补测”。

**Research Findings**:
- 仓库当前为 greenfield，无现有代码模式可复用。
- FTP/FTPS 推荐 `basic-ftp`，SFTP 推荐 `ssh2-sftp-client` + `ssh2`。
- 关键风险点：超时重连、FTP 单连接串行限制、编码兼容、Promise 混用、NAT/被动模式差异。

### Metis Review
**Identified Gaps (addressed)**:
- 补充了安全 guardrails：禁止明文凭据、生产强校验证书/host key。
- 锁定 V1 范围，排除 RBAC/SSO/分布式队列等扩展。
- 补充了边界条件：在线编辑仅文本小文件、批量操作采用 best-effort 并返回逐项结果。

### Defaults Applied
- 数据库：V1 默认 SQLite（后续可迁移 PostgreSQL）。
- 审计：V1 启用最小审计日志（连接与批量关键动作）。
- 安全：生产默认严格证书/host key 校验，不启用 insecure 模式。

---

## Work Objectives

### Core Objective
交付一个可部署、可验证、可安全使用的 FTP/FTPS/SFTP Web 管理工具 V1，覆盖连接生命周期与核心文件操作闭环。

### Concrete Deliverables
- Next.js 项目结构与运行环境（本地 + Docker）
- 加密凭据存储、连接测试、连接池与重试机制
- 协议统一服务层与 API 路由层
- WebUI 页面：连接管理、文件管理、在线编辑、批量执行
- 测试与验证资产（API、E2E、并发烟测、证据文件）

### Definition of Done
- [x] `docker compose up -d --build` 能启动应用与依赖测试服务
- [x] `curl http://localhost:3000/api/health` 返回健康状态
- [x] V1 全部功能有 agent 可执行 QA 场景并产出证据文件
- [x] 自动化测试可运行且关键路径通过

### Must Have
- 三协议支持：FTP/FTPS/SFTP
- 连接 CRUD + 连通性测试
- 文件浏览、上传、下载、在线编辑、批量操作
- 凭据加密存储（AES-256-GCM）
- Docker 单机可部署

### Must NOT Have (Guardrails)
- 不做多用户/RBAC/SSO
- 不做分布式任务队列与多节点编排
- 不允许明文存储凭据
- 不允许生产环境跳过 TLS/host key 校验
- 不将在线编辑扩展到大文件或二进制文件

## Frontend UI/UX Standards (V1)

### Experience Principles
- 主目标：高信息密度但可快速扫描，优先让“连接状态 + 文件操作”一眼可见。
- 关键心智：先连接、再浏览、后操作；路径与上下文不可丢。
- 反馈优先级：阻断错误 > 操作结果 > 进度状态 > 次级提示。

### Information Architecture & Route Conventions
- 路由层级建议：`/connections`（连接管理）→ `/files/[connectionId]`（文件浏览）→ `/files/[connectionId]/edit?path=`（在线编辑）。
- 每个关键路由段都应配置 `loading.tsx` 与 `error.tsx`，避免页面级白屏和不可恢复错误。
- 路由状态切换需保留上下文：连接 ID、当前路径、筛选条件应可从 URL 还原。
- 路由契约统一：禁止 `files?connectionId=` 查询串模式；页面与 E2E 仅使用路由参数模式。
- 空上下文回退：`connectionId` 缺失/失效时必须展示恢复型空状态（返回连接页/重新选择连接/新建连接），并禁用文件操作按钮。

### Visual System Baseline
- 采用清晰对比的专业运维风格（中性主色 + 功能语义色：成功/警告/失败）。
- 保持可读字号层级：标题、路径、文件名、元信息、状态标签分级明显。
- 列表与表格优先可读性：列宽策略、对齐规则、长文件名截断策略固定。

### Tool-Derived Baseline (`ui-ux-pro-max`)
- 推荐主模式：`Data-Dense + Drill-Down`（高信息密度运维台）。
- 推荐组件风格：KPI 状态卡 + 紧凑数据表 + 任务进度区 + 目录路径面包屑。
- 图标规范：统一使用 Lucide SVG（如 `File`/`Upload`/`Download`/`Check`/`XCircle`），禁用 emoji 图标。
- 颜色候选：
  - 候选 A（深色运维）：`#0F172A/#1E293B/#22C55E/#020617/#F8FAFC`
  - 候选 B（浅色分析）：`#1E40AF/#3B82F6/#F59E0B/#F8FAFC/#1E3A8A`
- 字体候选：
  - 候选 A（技术监控）：`Fira Code + Fira Sans`
  - 候选 B（企业可读）：`Lexend + Source Sans 3`
  - 中文界面兜底：`Noto Sans SC`

### Interaction Standards
- 连接管理：新增/编辑使用一致表单结构，测试按钮在主操作区可直达。
- 文件浏览：目录切换必须保留面包屑与当前路径；刷新操作可见。
- 传输任务：上传/下载必须展示进行中、成功、失败三态与可追溯错误原因。
- 在线编辑：保存前后状态明确，冲突时必须展示“覆盖风险”而非静默失败。
- 批量操作：采用 best-effort，结果面板逐项展示成功/失败与重试入口。
- 路由级状态：关键页面使用 `loading.tsx` 与 `error.tsx`，避免组件内散乱 loading/error 逻辑。
- 异步可达性：动态结果区域（连接测试、批量结果、上传进度）必须有 `aria-live`。

### Destructive Operation Safety
- 删除/批量删除必须二次确认；批量删除需显示“将影响 N 项”。
- 对不可逆操作增加目标摘要（路径、连接名、数量）并要求显式确认。
- 删除执行后结果面板必须逐项展示并支持仅重试失败项。
- 不可逆操作分级：当批量项数 >= 5 或目标包含高风险路径时，要求输入 `DELETE` 后才可执行。
- 执行前防漂移：批量/删除请求逐项校验目标状态（如 etag/mtime/存在性）；变化项返回 `STALE_TARGET` 并提示刷新后重试。

### Responsive & Accessibility Standards
- 断点：Desktop（>=1280）、Tablet（768-1279）、Mobile（<768）三档。
- 键盘可达：主要操作按钮、表单、列表行支持 Tab 导航。
- 色彩可达：文本与背景对比满足 WCAG AA 基线。
- 状态表达：颜色 + 图标/文本双通道，不仅依赖颜色区分。
- 焦点规范：禁止仅 `outline-none`，必须提供可见 `focus-visible` 样式。
- 语义规范：优先语义标签（button/label/input/table）；避免用 div 模拟可交互控件。
- 弹窗可达性：所有弹窗/抽屉需满足 `role="dialog"`、`aria-modal="true"`、焦点陷阱、`Esc` 关闭、关闭后焦点返回触发源。
- 读屏播报策略：进度类用 `aria-live="polite"` 且至少 500ms 节流；阻断错误用 `assertive`；同任务只播报开始/完成/失败。

### Frontend Performance Baseline
- 首屏核心区域在常规开发机环境下保持可交互（TTI）在可接受范围。
- 大目录列表采用分页或虚拟化策略，避免一次渲染过多节点。
- 避免阻塞主线程的同步大计算，上传/下载进度更新节流显示。
- 列表虚拟化阈值：单列表项目数 > 50 时必须启用虚拟化或分页。
- 代码拆分：重型组件（编辑器、大表格）采用动态加载。
- 页面级异步状态必须可见：加载骨架或 spinner，不允许白屏等待。
- 性能验收阈值（本地 Docker 常规开发机）：TTI <= 3.0s、路由切换可交互 <= 800ms、100 项目录刷新 <= 1.0s。

### Testability Contract (Frontend)
- 关键交互元素必须提供稳定选择器（如 `data-testid`）供 E2E 使用。
- 连接、文件、编辑、批量四条主流程都必须有 happy-path + error-path 场景。
- 关键失败提示必须带可断言错误码文案（如 `INVALID_PATH`、`AUTH_FAILED`）。
- 选择器命名规范：`connection-*`、`file-*`、`editor-*`、`batch-*` 前缀，避免样式类名作为测试锚点。
- E2E 选择器契约：断言与交互优先 `data-testid`，不得以 class 作为主选择器。

### Source Standards (Authoritative)
- Next.js App Router 规范：`https://nextjs.org/docs/app`
- Loading/Error 边界：`https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming` 与 `https://nextjs.org/docs/app/building-your-application/routing/error-handling`
- Web 可访问性与 WCAG 2.1：`https://www.w3.org/TR/WCAG21/`

### Frontend Acceptance Checklist
- [x] 连接页、文件页、编辑页在三种断点下布局可用。
- [x] 所有关键操作有明确加载态、成功态、失败态。
- [x] 错误提示可定位（字段/路径/连接维度），无“未知错误”泛化文案。
- [x] 批量操作结果面板包含逐项结果与失败重试入口。
- [x] 不展示敏感字段（密码/私钥明文）。
- [x] 所有关键异步区块具备 `aria-live` 或同级可达性反馈。
- [x] 关键交互元素具备键盘可达与可见焦点样式。

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — 所有验收由 agent 执行，禁止“用户手动验证”。

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: Tests-after
- **Framework**: Vitest + Supertest + Playwright
- **If TDD**: N/A（本次选 tests-after）

### QA Policy
每个任务必须包含 agent-executed QA scenarios，证据输出到 `.sisyphus/evidence/`。

- **Frontend/UI**: Playwright（导航、交互、断言 DOM、截图）
- **CLI/TUI**: interactive_bash（需要时）
- **API/Backend**: Bash + curl（状态码与响应字段断言）
- **Library/Module**: Bash（node/vitest 命令校验）

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately — foundation):
- T1 项目脚手架与基础配置
- T2 依赖与工程规范基线
- T3 数据模型与持久化层骨架
- T4 凭据加密模块
- T5 协议适配接口层
- T6 Docker 测试环境（FTP/FTPS/SFTP）
- T7 错误模型与日志规范

Wave 2 (After Wave 1 — core backend):
- T8 FTP/FTPS 适配器实现
- T9 SFTP 适配器实现
- T10 连接管理服务（CRUD+测试）
- T11 连接池/超时/重试服务
- T12 文件浏览服务
- T13 上传下载服务
- T14 在线编辑服务（文本小文件）

Wave 3 (After Wave 2 — API + UI):
- T15 连接相关 API
- T16 文件相关 API（含批量）
- T17 WebUI：连接管理页
- T18 WebUI：文件浏览与传输页
- T19 WebUI：在线编辑与批量操作交互
- T20 安全加固（SSRF/路径穿越/输入校验）

Wave 4 (After Wave 3 — testing & delivery):
- T21 自动化测试补齐（单元+集成）
- T22 Playwright E2E 场景
- T23 并发与恢复烟测（10-20 连接）
- T24 部署文档与运维回归脚本

Wave FINAL (After ALL tasks — independent review):
- F1 Plan Compliance Audit（oracle）
- F2 Code Quality Review（unspecified-high）
- F3 Real Manual QA（unspecified-high + playwright）
- F4 Scope Fidelity Check（deep）

Critical Path: T1 -> T5 -> T10 -> T16 -> T21 -> F1-F4
Parallel Speedup: ~65% vs sequential
Max Concurrent: 7（Wave 1/2）

### Dependency Matrix
- T1: Blocked By None | Blocks T15,T17,T18,T19,T21
- T2: Blocked By None | Blocks T8,T9,T10,T11,T12,T13,T14,T21
- T3: Blocked By None | Blocks T10,T15,T16,T21
- T4: Blocked By None | Blocks T10,T20,T21
- T5: Blocked By None | Blocks T8,T9,T10,T12,T13,T14
- T6: Blocked By None | Blocks T8,T9,T10,T13,T22,T23
- T7: Blocked By None | Blocks T8,T9,T10,T11,T15,T16,T20
- T8: Blocked By T2,T5,T6,T7 | Blocks T10,T12,T13,T14,T16,T23
- T9: Blocked By T2,T5,T6,T7 | Blocks T10,T12,T13,T14,T16,T23
- T10: Blocked By T2,T3,T4,T5,T6,T7,T8,T9 | Blocks T15,T16,T17,T18,T19,T21,T22,T23
- T11: Blocked By T2,T7 | Blocks T13,T16,T23
- T12: Blocked By T2,T5,T8,T9 | Blocks T16,T18,T19,T21,T22
- T13: Blocked By T2,T5,T6,T8,T9,T11 | Blocks T16,T18,T22,T23
- T14: Blocked By T2,T5,T8,T9 | Blocks T16,T19,T21,T22
- T15: Blocked By T1,T3,T7,T10 | Blocks T17,T21,T22
- T16: Blocked By T3,T7,T8,T9,T10,T11,T12,T13,T14 | Blocks T18,T19,T21,T22,T23
- T17: Blocked By T1,T10,T15 | Blocks T19,T22
- T18: Blocked By T1,T10,T12,T13,T16 | Blocks T19,T22
- T19: Blocked By T1,T10,T12,T14,T16,T17,T18 | Blocks T22,T23
- T20: Blocked By T4,T7,T10,T16 | Blocks T21,T22,T23
- T21: Blocked By T1,T2,T3,T4,T10,T12,T14,T15,T16,T20 | Blocks F1,F2,F3,F4
- T22: Blocked By T6,T10,T12,T13,T14,T15,T16,T17,T18,T19,T20 | Blocks F1,F3,F4
- T23: Blocked By T6,T8,T9,T10,T11,T13,T16,T19,T20 | Blocks F1,F2,F4
- T24: Blocked By T21,T22,T23 | Blocks F1,F2,F3,F4

### Agent Dispatch Summary
- Wave 1: T1/T2/T3/T4/T5/T6/T7 -> `quick` x5 + `unspecified-high` x2
- Wave 2: T8/T9/T10/T11/T12/T13/T14 -> `unspecified-high` x5 + `deep` x2
- Wave 3: T15/T16/T17/T18/T19/T20 -> `unspecified-high` x4 + `visual-engineering` x2
- Wave 4: T21/T22/T23/T24 -> `deep` x2 + `unspecified-high` x1 + `writing` x1
- FINAL: F1/F2/F3/F4 -> `oracle` + `unspecified-high` + `unspecified-high` + `deep`

---

## TODOs

- [x] 1. 初始化 Next.js 一体化工程与运行脚本

  **What to do**:
  - 创建 Next.js（App Router, TypeScript）基础目录与启动脚本。
  - 配置 `.env.example`、基础健康检查路由与最小首页骨架。

  **Must NOT do**:
  - 不引入与 V1 无关的多租户/插件系统。

  **Recommended Agent Profile**:
  - **Category**: `quick`（脚手架和标准配置任务）
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 保证 WebUI 起始结构清晰可扩展
  - **Skills Evaluated but Omitted**:
    - `playwright`: 当前任务不涉及 UI 自动化执行

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（与 T2-T7 并行）
  - **Blocks**: T15,T17,T18,T19,T21
  - **Blocked By**: None

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 用户确认的目标与边界来源。
  - External: `https://nextjs.org/docs/app/getting-started/project-structure` - App Router 标准目录结构。

  **Acceptance Criteria**:
  - [ ] `pnpm dev` 可启动。
  - [ ] `GET /api/health` 返回 200 且含 `status: ok`。

  **QA Scenarios**:
  ```
  Scenario: 健康检查可用
    Tool: Bash (curl)
    Preconditions: 本地服务已启动在 3000
    Steps:
      1. curl -s http://localhost:3000/api/health
      2. 断言 JSON 字段 status 等于 "ok"
    Expected Result: 返回 200 且 status=ok
    Failure Indicators: 非 200 或缺少 status 字段
    Evidence: .sisyphus/evidence/task-1-health.json

  Scenario: 未知路由返回 404
    Tool: Bash (curl)
    Preconditions: 本地服务已启动
    Steps:
      1. curl -s -o /tmp/t1-404.out -w "%{http_code}" http://localhost:3000/api/not-found
      2. 断言状态码=404
    Expected Result: 正确 404
    Evidence: .sisyphus/evidence/task-1-404.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-1-health.json`
  - [ ] `task-1-404.txt`

  **Commit**: YES
  - Message: `chore(scaffold): bootstrap nextjs app shell`

- [x] 2. 建立依赖与工程规范基线

  **What to do**:
  - 引入核心依赖（basic-ftp、ssh2-sftp-client、zod、pino 等）。
  - 配置 lint/format/typecheck 脚本与统一错误码常量。

  **Must NOT do**:
  - 不加入未在 V1 使用的重量级依赖。

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 保持前后端共享约束的一致性
  - **Skills Evaluated but Omitted**:
    - `playwright`: 当前不涉及浏览器测试

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T8,T9,T10,T11,T12,T13,T14,T21
  - **Blocked By**: None

  **References**:
  - External: `https://github.com/patrickjuchli/basic-ftp` - FTP/FTPS 客户端接口依据。
  - External: `https://github.com/theophilusx/ssh2-sftp-client` - SFTP Promise API 依据。
  - Why: 保证依赖选型与已调研结论一致。

  **Acceptance Criteria**:
  - [ ] `pnpm lint`、`pnpm typecheck` 可执行。
  - [ ] 依赖版本锁定并可安装。

  **QA Scenarios**:
  ```
  Scenario: 工程脚本可运行
    Tool: Bash
    Preconditions: 安装依赖完成
    Steps:
      1. 运行 pnpm lint
      2. 运行 pnpm typecheck
    Expected Result: 两个命令 exit code=0
    Failure Indicators: 任一命令报错
    Evidence: .sisyphus/evidence/task-2-quality.txt

  Scenario: 缺失环境变量会阻止启动
    Tool: Bash
    Preconditions: 清空关键密钥环境变量
    Steps:
      1. 启动应用
      2. 断言进程以明确错误退出
    Expected Result: 启动失败并提示缺失变量名
    Evidence: .sisyphus/evidence/task-2-env-error.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-2-quality.txt`
  - [ ] `task-2-env-error.txt`

  **Commit**: YES
  - Message: `chore(core): add dependencies and quality scripts`

- [x] 3. 定义连接配置数据模型与持久化骨架

  **What to do**:
  - 设计连接实体（协议、主机、端口、用户名、加密凭据、标签、更新时间）。
  - 建立持久化层接口与默认实现（V1 默认 SQLite）。

  **Must NOT do**:
  - 不实现多租户字段与权限表。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: 约束结构变更可追溯
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 本任务非 UI 主导

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T10,T15,T16,T21
  - **Blocked By**: None

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 已确认单管理员与凭据加密约束。
  - External: `https://sqlite.org/docs.html` - SQLite 数据约束设计依据。

  **Acceptance Criteria**:
  - [ ] 能创建并读取连接记录。
  - [ ] 凭据字段不以明文落盘。

  **QA Scenarios**:
  ```
  Scenario: 连接记录可持久化
    Tool: Bash
    Preconditions: 数据库初始化完成
    Steps:
      1. 调用创建连接 API 写入一条记录
      2. 调用列表 API 读取记录
      3. 断言协议/主机字段匹配
    Expected Result: 记录可读且字段正确
    Failure Indicators: 无记录或字段缺失
    Evidence: .sisyphus/evidence/task-3-persistence.json

  Scenario: 明文凭据不可见
    Tool: Bash
    Preconditions: 已创建带密码的连接
    Steps:
      1. 直接查询存储层原始记录
      2. 断言无明文 password
    Expected Result: 仅存在密文/掩码字段
    Evidence: .sisyphus/evidence/task-3-no-plaintext.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-3-persistence.json`
  - [ ] `task-3-no-plaintext.txt`

  **Commit**: YES
  - Message: `feat(data): add connection model and storage interface`

- [x] 4. 实现凭据加密与密钥加载模块

  **What to do**:
  - 实现 AES-256-GCM 加解密与密钥派生/加载逻辑。
  - 提供密钥缺失、密文损坏、版本不匹配等错误类型。

  **Must NOT do**:
  - 不允许 fallback 到明文存储。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: 关键安全模块变更需精确管理
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 非 UI 任务

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T10,T20,T21
  - **Blocked By**: None

  **References**:
  - External: `https://nodejs.org/api/crypto.html` - AES-GCM 与密钥 API 官方规范。
  - External: `https://owasp.org/www-project-cheat-sheets/` - 密钥与敏感信息处理准则。

  **Acceptance Criteria**:
  - [ ] 同一明文加密后可正确解密。
  - [ ] 密钥错误时解密失败且返回可识别错误码。

  **QA Scenarios**:
  ```
  Scenario: 加解密闭环成功
    Tool: Bash
    Preconditions: 设置 APP_MASTER_KEY
    Steps:
      1. 运行加密函数处理 "Demo#123"
      2. 用同密钥解密
      3. 断言输出等于原文
    Expected Result: 解密值精确匹配
    Failure Indicators: 解密异常或值不一致
    Evidence: .sisyphus/evidence/task-4-crypto-ok.txt

  Scenario: 错误密钥解密失败
    Tool: Bash
    Preconditions: 使用不同密钥
    Steps:
      1. 加密后切换密钥
      2. 执行解密并捕获错误
    Expected Result: 返回 CRYPTO_DECRYPT_FAILED
    Evidence: .sisyphus/evidence/task-4-crypto-error.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-4-crypto-ok.txt`
  - [ ] `task-4-crypto-error.txt`

  **Commit**: YES
  - Message: `feat(security): add credential encryption module`

- [x] 5. 设计统一协议适配接口（FTP/FTPS/SFTP）

  **What to do**:
  - 定义统一操作契约：connect/test/list/upload/download/readText/writeText/batch。
  - 约束协议特性差异：公共能力统一，协议特有能力透传扩展字段。

  **Must NOT do**:
  - 不把协议差异硬编码到 UI 层。

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`]
    - `git-master`: 接口定义一旦扩散变更成本高，需严谨
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 本任务在领域模型层

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T8,T9,T10,T12,T13,T14
  - **Blocked By**: None

  **References**:
  - External: `https://github.com/patrickjuchli/basic-ftp` - FTP 操作边界。
  - External: `https://github.com/theophilusx/ssh2-sftp-client` - SFTP 操作边界。
  - Why: 统一接口必须覆盖两类库的最小公共能力。

  **Acceptance Criteria**:
  - [ ] 统一接口能表达 V1 全部操作。
  - [ ] 新增协议实现不需要改 UI/API 层签名。

  **QA Scenarios**:
  ```
  Scenario: 接口契约可被双协议实现
    Tool: Bash
    Preconditions: 定义协议接口与两个实现桩
    Steps:
      1. 以同一签名调用 ftpAdapter/sftpAdapter 的 list
      2. 断言返回结构一致
    Expected Result: 统一响应结构通过断言
    Failure Indicators: 字段差异导致断言失败
    Evidence: .sisyphus/evidence/task-5-contract-ok.txt

  Scenario: 未实现方法会被编译期拦截
    Tool: Bash
    Preconditions: 人为删去某实现的方法
    Steps:
      1. 运行 pnpm typecheck
      2. 断言出现接口不满足错误
    Expected Result: 编译失败并指向缺失方法
    Evidence: .sisyphus/evidence/task-5-contract-error.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-5-contract-ok.txt`
  - [ ] `task-5-contract-error.txt`

  **Commit**: YES
  - Message: `feat(core): define protocol adapter contract`

- [x] 6. 搭建 Docker 测试环境（FTP/FTPS/SFTP）

  **What to do**:
  - 准备 docker-compose：应用容器 + FTP/FTPS/SFTP 测试服务容器。
  - 固定测试账号与目录，便于自动化场景复用。

  **Must NOT do**:
  - 不将测试凭据写入生产配置。

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]
    - `git-master`: 环境配置修改需可追溯
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 非界面任务

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T8,T9,T10,T13,T22,T23
  - **Blocked By**: None

  **References**:
  - External: `https://docs.docker.com/compose/` - Compose 编排规范。
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 单机 Docker 部署约束。

  **Acceptance Criteria**:
  - [ ] `docker compose up -d` 后三协议测试服务可连通。
  - [ ] 测试账户可执行最小读写。

  **QA Scenarios**:
  ```
  Scenario: 三协议容器可用
    Tool: Bash
    Preconditions: docker 可用
    Steps:
      1. docker compose up -d
      2. docker compose ps
      3. 断言 ftp/ftps/sftp 容器均为 healthy/running
    Expected Result: 所有依赖服务可用
    Failure Indicators: 任一容器退出或 unhealthy
    Evidence: .sisyphus/evidence/task-6-compose.txt

  Scenario: 错误端口连接失败
    Tool: Bash
    Preconditions: 服务已启动
    Steps:
      1. 使用错误端口执行连接测试
      2. 断言返回 CONNECTION_TIMEOUT/REFUSED
    Expected Result: 明确失败码
    Evidence: .sisyphus/evidence/task-6-port-error.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-6-compose.txt`
  - [ ] `task-6-port-error.txt`

  **Commit**: YES
  - Message: `chore(devops): add local ftp/ftps/sftp compose stack`

- [x] 7. 建立错误模型与日志脱敏规范

  **What to do**:
  - 统一错误码（连接失败、认证失败、权限拒绝、路径非法、编码不支持等）。
  - 统一日志结构并对密码、私钥、token 做脱敏。

  **Must NOT do**:
  - 不把原始凭据或密文直接打日志。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: 全局错误规范影响广
  - **Skills Evaluated but Omitted**:
    - `playwright`: 本任务不涉及浏览器自动化

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T8,T9,T10,T11,T15,T16,T20
  - **Blocked By**: None

  **References**:
  - External: `https://owasp.org/www-project-logging-cheat-sheet/` - 安全日志基线。
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 安全边界来源。

  **Acceptance Criteria**:
  - [ ] 所有 API 错误都返回标准错误码。
  - [ ] 日志中无法检索到明文凭据。

  **QA Scenarios**:
  ```
  Scenario: 标准错误响应
    Tool: Bash (curl)
    Preconditions: 启动服务
    Steps:
      1. 调用不存在连接的测试接口
      2. 断言 response.error.code=CONNECTION_NOT_FOUND
    Expected Result: 结构化错误返回
    Failure Indicators: 仅字符串错误或无 code
    Evidence: .sisyphus/evidence/task-7-error-format.json

  Scenario: 日志无敏感信息
    Tool: Bash
    Preconditions: 触发一次连接失败日志
    Steps:
      1. 导出应用日志
      2. grep 检查密码明文样例
    Expected Result: 无命中
    Evidence: .sisyphus/evidence/task-7-log-redaction.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-7-error-format.json`
  - [ ] `task-7-log-redaction.txt`

  **Commit**: YES
  - Message: `feat(core): standardize error codes and secure logging`

- [x] 8. 实现 FTP/FTPS 适配器（basic-ftp）

  **What to do**:
  - 完成 FTP/FTPS 连接、目录列表、上传下载、重连封装。
  - 加入被动模式与编码 fallback 配置。

  **Must NOT do**:
  - 不允许在生产默认关闭证书校验。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: 协议适配逻辑复杂，需稳定提交边界
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 非 UI 任务

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2（与 T9-T14 并行）
  - **Blocks**: T10,T12,T13,T14,T16,T23
  - **Blocked By**: T2,T5,T6,T7

  **References**:
  - External: `https://github.com/patrickjuchli/basic-ftp` - 官方 API 与错误语义。
  - Why: `FTPError` 与连接关闭语义直接影响重试策略。

  **Acceptance Criteria**:
  - [ ] 可连接测试 FTPS 服务并列出根目录。
  - [ ] 连接中断后可按策略重连。

  **QA Scenarios**:
  ```
  Scenario: FTPS 列表成功
    Tool: Bash (curl)
    Preconditions: compose FTPS 服务正常
    Steps:
      1. 创建 FTPS 连接配置
      2. 调用 browse API path="/"
      3. 断言返回 items 数组
    Expected Result: 列表成功返回
    Failure Indicators: TLS/认证失败
    Evidence: .sisyphus/evidence/task-8-ftps-list.json

  Scenario: 错误证书策略触发失败
    Tool: Bash (curl)
    Preconditions: 使用无效证书配置
    Steps:
      1. 发起连接测试
      2. 断言 error.code=TLS_VALIDATION_FAILED
    Expected Result: 明确拒绝连接
    Evidence: .sisyphus/evidence/task-8-ftps-cert-error.json
  ```

  **Evidence to Capture:**
  - [ ] `task-8-ftps-list.json`
  - [ ] `task-8-ftps-cert-error.json`

  **Commit**: YES
  - Message: `feat(adapter): implement ftp and ftps adapter`

- [x] 9. 实现 SFTP 适配器（ssh2-sftp-client）

  **What to do**:
  - 实现 SFTP 连接、目录操作、上传下载与 fastGet/fastPut。
  - 支持密码与私钥认证配置。

  **Must NOT do**:
  - 不绕过 host key 校验策略（生产）。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: 协议行为与错误码映射需要稳定迭代
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 非 UI 任务

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T10,T12,T13,T14,T16,T23
  - **Blocked By**: T2,T5,T6,T7

  **References**:
  - External: `https://github.com/theophilusx/ssh2-sftp-client` - Promise API 与常见陷阱。
  - External: `https://github.com/mscdex/ssh2` - 认证与 keepalive 配置。

  **Acceptance Criteria**:
  - [ ] SFTP 列表与上传下载可运行。
  - [ ] 无效 host key 被正确拒绝。

  **QA Scenarios**:
  ```
  Scenario: SFTP fastGet 成功
    Tool: Bash (curl)
    Preconditions: sftp 测试容器可用
    Steps:
      1. 上传一个测试文件
      2. 调用下载 API 使用 fastGet 路径
      3. 断言下载文件 checksum 一致
    Expected Result: 文件完整一致
    Failure Indicators: 下载失败或 checksum 不一致
    Evidence: .sisyphus/evidence/task-9-fastget.txt

  Scenario: host key 校验失败
    Tool: Bash (curl)
    Preconditions: 配置错误 host key
    Steps:
      1. 调用连接测试接口
      2. 断言 error.code=HOST_KEY_MISMATCH
    Expected Result: 明确拒绝
    Evidence: .sisyphus/evidence/task-9-hostkey-error.json
  ```

  **Evidence to Capture:**
  - [ ] `task-9-fastget.txt`
  - [ ] `task-9-hostkey-error.json`

  **Commit**: YES
  - Message: `feat(adapter): implement sftp adapter`

- [x] 10. 实现连接管理服务（CRUD + 连通性测试）

  **What to do**:
  - 实现连接新增、更新、删除、列表、详情。
  - 实现“测试连接”能力并返回标准诊断信息。

  **Must NOT do**:
  - 不返回明文凭据给前端。

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`]
    - `git-master`: 核心业务服务，影响 API/UI 多层
  - **Skills Evaluated but Omitted**:
    - `playwright`: 本任务主要后端服务

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T15,T16,T17,T18,T19,T21,T22,T23
  - **Blocked By**: T2,T3,T4,T5,T6,T7,T8,T9

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - V1 功能清单与安全要求。
  - External: `https://zod.dev/` - 输入校验和错误信息标准化。

  **Acceptance Criteria**:
  - [ ] 连接 CRUD API 可用。
  - [ ] `test connection` 返回协议级成功/失败细节。

  **QA Scenarios**:
  ```
  Scenario: 连接 CRUD 闭环
    Tool: Bash (curl)
    Preconditions: 服务启动
    Steps:
      1. POST 创建连接
      2. GET 列表并取 id
      3. PATCH 修改备注
      4. DELETE 删除并确认不存在
    Expected Result: 全流程状态码正确
    Failure Indicators: 任一阶段状态码异常
    Evidence: .sisyphus/evidence/task-10-crud.json

  Scenario: 错误密码测试失败
    Tool: Bash (curl)
    Preconditions: 创建错误密码连接
    Steps:
      1. POST /test
      2. 断言 error.code=AUTH_FAILED
    Expected Result: 明确认证失败
    Evidence: .sisyphus/evidence/task-10-auth-error.json
  ```

  **Evidence to Capture:**
  - [ ] `task-10-crud.json`
  - [ ] `task-10-auth-error.json`

  **Commit**: YES
  - Message: `feat(connection): add secure connection management service`

- [x] 11. 实现连接池、超时与指数退避重试

  **What to do**:
  - 构建每协议连接池策略（单连接单操作限制下的并发控制）。
  - 实现超时、重试、熔断基础策略与可观测指标。

  **Must NOT do**:
  - 不进行无限重试。

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`]
    - `git-master`: 运行时行为复杂，需细粒度提交
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 非视觉任务

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T13,T16,T23
  - **Blocked By**: T2,T7

  **References**:
  - External: `https://github.com/patrickjuchli/basic-ftp` - 连接关闭与重连语义。
  - External: `https://github.com/mscdex/ssh2` - keepalive/readyTimeout 参数含义。

  **Acceptance Criteria**:
  - [ ] 可配置最大并发连接数。
  - [ ] 临时故障在重试窗口内可恢复。

  **QA Scenarios**:
  ```
  Scenario: 临时断连后重试成功
    Tool: Bash
    Preconditions: 启动服务并可控制目标服务重启
    Steps:
      1. 发起文件操作
      2. 中途重启目标服务一次
      3. 断言在重试后成功完成
    Expected Result: 请求最终成功，记录重试次数
    Failure Indicators: 直接失败无重试
    Evidence: .sisyphus/evidence/task-11-retry-ok.txt

  Scenario: 超过重试上限后失败
    Tool: Bash
    Preconditions: 配置不可达主机
    Steps:
      1. 发起连接测试
      2. 断言超限后返回 RETRY_EXHAUSTED
    Expected Result: 明确失败且耗时在阈值内
    Evidence: .sisyphus/evidence/task-11-retry-fail.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-11-retry-ok.txt`
  - [ ] `task-11-retry-fail.txt`

  **Commit**: YES
  - Message: `feat(runtime): add pooling timeout and retry policy`

- [x] 12. 实现文件浏览服务（list/stat/path normalize）

  **What to do**:
  - 实现目录列表、文件元信息、路径规范化。
  - 处理编码与目录项差异（FTP/SFTP）。

  **Must NOT do**:
  - 不允许路径穿越（`..` 越权）。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: 文件协议细节多，需稳定演进
  - **Skills Evaluated but Omitted**:
    - `playwright`: 本任务后端优先

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T16,T18,T19,T21,T22
  - **Blocked By**: T2,T5,T8,T9

  **References**:
  - External: `https://github.com/patrickjuchli/basic-ftp` - `list()` 返回结构。
  - External: `https://github.com/theophilusx/ssh2-sftp-client` - `list()` 字段定义。

  **Acceptance Criteria**:
  - [ ] 根目录与子目录列表都可返回。
  - [ ] 路径规范化后禁止越界路径。

  **QA Scenarios**:
  ```
  Scenario: 目录浏览成功
    Tool: Bash (curl)
    Preconditions: 有测试目录 /demo
    Steps:
      1. 调用 browse(path="/")
      2. 调用 browse(path="/demo")
      3. 断言 items 包含 name/type/size
    Expected Result: 两次浏览均返回结构化列表
    Failure Indicators: 缺字段或异常
    Evidence: .sisyphus/evidence/task-12-browse.json

  Scenario: 路径穿越被拒绝
    Tool: Bash (curl)
    Preconditions: 服务运行
    Steps:
      1. 调用 browse(path="../../etc")
      2. 断言 error.code=INVALID_PATH
    Expected Result: 请求被拒绝
    Evidence: .sisyphus/evidence/task-12-path-error.json
  ```

  **Evidence to Capture:**
  - [ ] `task-12-browse.json`
  - [ ] `task-12-path-error.json`

  **Commit**: YES
  - Message: `feat(file): add browse service with path normalization`

- [x] 13. 实现上传下载服务（流式 + 进度 + 续传）

  **What to do**:
  - 实现统一上传/下载服务，优先流式传输，避免大文件内存峰值。
  - 提供基础进度事件与断点续传能力（按协议能力降级）。

  **Must NOT do**:
  - 不使用一次性全量内存读取大文件。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: 文件传输逻辑涉及多协议与异常路径
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 本任务后端传输优先

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T16,T18,T22,T23
  - **Blocked By**: T2,T5,T6,T8,T9,T11

  **References**:
  - External: `https://github.com/patrickjuchli/basic-ftp` - upload/download/append API。
  - External: `https://github.com/theophilusx/ssh2-sftp-client` - `get/put/fastGet/fastPut` 与流式说明。
  - Why: 确保大文件策略与协议能力匹配。

  **Acceptance Criteria**:
  - [ ] 上传下载接口返回可追踪任务结果。
  - [ ] 大文件传输不触发 OOM，且可输出进度信息。

  **QA Scenarios**:
  ```
  Scenario: 上传下载回环成功
    Tool: Bash (curl)
    Preconditions: 已创建可用连接；本地有 10MB 测试文件
    Steps:
      1. 调用 upload API 上传至 /upload/test.bin
      2. 调用 download API 下载到本地
      3. 对比源文件与下载文件 checksum
    Expected Result: checksum 一致
    Failure Indicators: 上传/下载失败或 checksum 不一致
    Evidence: .sisyphus/evidence/task-13-transfer-roundtrip.txt

  Scenario: 超限文件被拒绝
    Tool: Bash (curl)
    Preconditions: 准备超过配置上限的文件
    Steps:
      1. 调用 upload API 上传超限文件
      2. 断言 error.code=FILE_TOO_LARGE
    Expected Result: 请求被拒绝且错误明确
    Evidence: .sisyphus/evidence/task-13-file-too-large.json
  ```

  **Evidence to Capture:**
  - [ ] `task-13-transfer-roundtrip.txt`
  - [ ] `task-13-file-too-large.json`

  **Commit**: YES
  - Message: `feat(file): add streaming upload and download service`

- [x] 14. 实现在线文本编辑服务（读写 + 冲突检测）

  **What to do**:
  - 提供文本文件读取与保存接口。
  - 增加版本/etag 冲突检测，避免覆盖并发修改。

  **Must NOT do**:
  - 不支持二进制或超大文件在线编辑。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: 编辑语义涉及并发冲突与编码处理
  - **Skills Evaluated but Omitted**:
    - `playwright`: 先完成后端语义再做 UI 测试

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T16,T19,T21,T22
  - **Blocked By**: T2,T5,T8,T9

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 在线编辑在 V1 范围内。
  - External: `https://github.com/theophilusx/ssh2-sftp-client` - 文本文件 get/put 操作范式。

  **Acceptance Criteria**:
  - [ ] 文本文件可读取并写回。
  - [ ] stale 版本写入返回冲突错误。

  **QA Scenarios**:
  ```
  Scenario: 文本读取与保存成功
    Tool: Bash (curl)
    Preconditions: 远端存在 /edit/demo.txt，内容为 "v1"
    Steps:
      1. 调用 readText API 获取内容与 etag
      2. 调用 writeText API 提交内容 "v2" + etag
      3. 再次读取并断言内容为 "v2"
    Expected Result: 更新成功且内容一致
    Failure Indicators: 写入失败或读取内容不一致
    Evidence: .sisyphus/evidence/task-14-edit-ok.json

  Scenario: 版本冲突被拒绝
    Tool: Bash (curl)
    Preconditions: 使用过期 etag
    Steps:
      1. 调用 writeText API 传入 stale etag
      2. 断言 error.code=FILE_VERSION_CONFLICT
    Expected Result: 正确阻止覆盖
    Evidence: .sisyphus/evidence/task-14-edit-conflict.json
  ```

  **Evidence to Capture:**
  - [ ] `task-14-edit-ok.json`
  - [ ] `task-14-edit-conflict.json`

  **Commit**: YES
  - Message: `feat(file): add online text editing with conflict control`

- [x] 15. 实现连接管理 API（REST）

  **What to do**:
  - 暴露连接 CRUD、连接测试、连接详情接口。
  - 统一输入校验与错误输出结构。

  **Must NOT do**:
  - 不在响应中返回明文密码或私钥内容。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: API 作为前后端契约需稳定
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 非 UI 层任务

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T17,T21,T22
  - **Blocked By**: T1,T3,T7,T10

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 连接管理是核心需求。
  - External: `https://zod.dev/` - 请求校验与错误标准化。

  **Acceptance Criteria**:
  - [ ] `/api/connections` 系列接口可用。
  - [ ] 输入非法时返回结构化 4xx 错误。

  **QA Scenarios**:
  ```
  Scenario: REST 接口完整可用
    Tool: Bash (curl)
    Preconditions: 服务已启动
    Steps:
      1. POST 创建连接
      2. GET 列表确认存在
      3. PATCH 更新名称
      4. DELETE 删除
    Expected Result: 全流程状态码符合预期
    Failure Indicators: 任一步骤状态码异常
    Evidence: .sisyphus/evidence/task-15-api-crud.json

  Scenario: 参数校验错误
    Tool: Bash (curl)
    Preconditions: 服务已启动
    Steps:
      1. POST 创建连接时传空 host
      2. 断言响应 400 且 error.code=VALIDATION_ERROR
    Expected Result: 明确参数校验失败
    Evidence: .sisyphus/evidence/task-15-api-validation.json
  ```

  **Evidence to Capture:**
  - [ ] `task-15-api-crud.json`
  - [ ] `task-15-api-validation.json`

  **Commit**: YES
  - Message: `feat(api): expose connection management endpoints`

- [x] 16. 实现文件操作 API（浏览/传输/编辑/批量）

  **What to do**:
  - 暴露文件浏览、上传、下载、读写文本与批量操作接口。
  - 统一批量结果格式：逐项 success/error。

  **Must NOT do**:
  - 不做 all-or-nothing 事务回滚语义（V1 采用 best-effort）。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]
    - `git-master`: 文件 API 影响面广且接口复杂
  - **Skills Evaluated but Omitted**:
    - `playwright`: 本任务先聚焦 API 语义

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T18,T19,T21,T22,T23
  - **Blocked By**: T3,T7,T8,T9,T10,T11,T12,T13,T14

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 文件操作完整范围。
  - External: `https://github.com/patrickjuchli/basic-ftp` - FTP 文件 API。
  - External: `https://github.com/theophilusx/ssh2-sftp-client` - SFTP 文件 API。

  **Acceptance Criteria**:
  - [ ] 所有文件 API 响应结构一致。
  - [ ] 批量操作返回逐项结果，失败不阻断其他项。

  **QA Scenarios**:
  ```
  Scenario: 批量操作部分成功
    Tool: Bash (curl)
    Preconditions: 目标目录存在 2 个有效路径 + 1 个无效路径
    Steps:
      1. 调用 batch API 删除 3 个路径
      2. 断言返回 results 长度=3
      3. 断言至少 1 success 与 1 failed
    Expected Result: best-effort 语义正确
    Failure Indicators: 整体失败或缺失逐项结果
    Evidence: .sisyphus/evidence/task-16-batch-partial.json

  Scenario: 非法路径被拒绝
    Tool: Bash (curl)
    Preconditions: 服务运行
    Steps:
      1. 调用 file API 传入 ../../path
      2. 断言 error.code=INVALID_PATH
    Expected Result: 请求被拒绝
    Evidence: .sisyphus/evidence/task-16-invalid-path.json
  ```

  **Evidence to Capture:**
  - [ ] `task-16-batch-partial.json`
  - [ ] `task-16-invalid-path.json`

  **Commit**: YES
  - Message: `feat(api): add file operation endpoints with batch semantics`

- [x] 17. 实现 WebUI 连接管理页

  **What to do**:
  - 提供连接列表、创建/编辑弹窗、连接测试与删除交互。
  - 展示协议、主机、状态、最近测试结果等关键信息。

  **Must NOT do**:
  - 不在 UI 明文展示敏感凭据。

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 保证桌面/移动端布局可用与交互清晰
  - **Skills Evaluated but Omitted**:
    - `git-master`: 该任务以 UI 构建为主

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T19,T22
  - **Blocked By**: T1,T10,T15

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 连接管理是 V1 首要页面。
  - Pattern: `.sisyphus/plans/ftp-webui-nodejs-v1.md` - 对齐 `Frontend UI/UX Standards (V1)` 的交互与可用性基线。
  - External: `https://nextjs.org/docs/app/building-your-application/routing` - 页面组织方式。

  **Acceptance Criteria**:
  - [ ] 能完成连接新增、编辑、测试、删除全流程 UI 操作。
  - [ ] 连接列表状态可实时刷新。

  **QA Scenarios**:
  ```
  Scenario: 连接页完整交互
    Tool: Playwright
    Preconditions: 服务启动；浏览器打开首页
    Steps:
      1. 打开 /connections
      2. 点击 [data-testid="connection-add-btn"] 打开表单
      3. 填写 test-sftp 连接信息并提交
      4. 点击该行 [data-testid="connection-test-btn"]
      5. 断言 [data-testid="connection-status"] 包含 "success"
    Expected Result: 新连接可创建并测试通过
    Failure Indicators: 表单提交失败或状态未更新
    Evidence: .sisyphus/evidence/task-17-ui-connection-success.png

  Scenario: 必填项校验提示
    Tool: Playwright
    Preconditions: 打开连接创建弹窗
    Steps:
      1. 清空 host 输入框 [data-testid="connection-host-input"]
      2. 点击 [data-testid="connection-save-btn"]
      3. 断言 [data-testid="connection-host-error"] 文本包含 "host"
    Expected Result: 阻止提交并显示错误
    Evidence: .sisyphus/evidence/task-17-ui-validation-error.png
  ```

  **Evidence to Capture:**
  - [ ] `task-17-ui-connection-success.png`
  - [ ] `task-17-ui-validation-error.png`

  **Commit**: YES
  - Message: `feat(ui): build connection management interface`

- [x] 18. 实现 WebUI 文件浏览与传输页

  **What to do**:
  - 提供目录树/列表浏览、路径导航、上传下载入口。
  - 展示传输进度与最近任务状态。

  **Must NOT do**:
  - 不做非 V1 的富预览能力（Office/PDF 渲染）。

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 处理复杂列表与响应式交互
  - **Skills Evaluated but Omitted**:
    - `git-master`: 该任务以界面表现为主

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T19,T22
  - **Blocked By**: T1,T10,T12,T13,T16

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 文件浏览/上传下载已明确在 V1。
  - Pattern: `.sisyphus/plans/ftp-webui-nodejs-v1.md` - 对齐 `Frontend UI/UX Standards (V1)` 的列表与状态反馈规则。
  - External: `https://playwright.dev/` - 后续 E2E 选择器可测试性要求。

  **Acceptance Criteria**:
  - [ ] 文件列表可分页/刷新并正确展示类型与大小。
  - [ ] 上传下载可触发并显示进度。
  - [ ] `connectionId` 缺失/失效时展示恢复型空状态并禁用文件操作。

  **QA Scenarios**:
  ```
  Scenario: 浏览与上传流程成功
    Tool: Playwright
    Preconditions: 已存在可用连接与 /upload 目录
    Steps:
      1. 打开 /files/<connectionId>
      2. 点击 [data-testid="file-path-root"] 并等待 [data-testid="file-table"] 加载
      3. 通过 [data-testid="file-upload-input"] 选择测试文件
      4. 断言 [data-testid="transfer-latest-status"] 状态为 success
    Expected Result: 文件上传完成并可在列表中看到
    Failure Indicators: 进度卡住或状态失败
    Evidence: .sisyphus/evidence/task-18-ui-upload-success.png

  Scenario: 非法路径访问失败
    Tool: Playwright
    Preconditions: 打开文件页
    Steps:
      1. 在路径输入 [data-testid="file-path-input"] 中填入 ../../etc
      2. 点击 [data-testid="file-path-go-btn"]
      3. 断言 [data-testid="toast-error"] 包含 "INVALID_PATH"
    Expected Result: 请求被拒绝并给出错误提示
    Evidence: .sisyphus/evidence/task-18-ui-invalid-path.png
  ```

  **Evidence to Capture:**
  - [ ] `task-18-ui-upload-success.png`
  - [ ] `task-18-ui-invalid-path.png`

  **Commit**: YES
  - Message: `feat(ui): build file explorer and transfer panel`

- [x] 19. 实现 WebUI 在线编辑与批量操作交互

  **What to do**:
  - 集成文本编辑器视图、保存冲突提示、批量勾选与批量执行结果面板。
  - 区分成功项/失败项并支持失败项重试。

  **Must NOT do**:
  - 不静默吞掉批量失败项。

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 编辑器与批量交互复杂度高
  - **Skills Evaluated but Omitted**:
    - `playwright`: 由后续 T22 统一覆盖 E2E

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T22,T23
  - **Blocked By**: T1,T10,T12,T14,T16,T17,T18

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 在线编辑和批量操作为确认需求。
  - Pattern: `.sisyphus/plans/ftp-webui-nodejs-v1.md` - 对齐 `Frontend UI/UX Standards (V1)` 的冲突提示与批量结果规范。
  - External: `https://nextjs.org/docs/app/getting-started/layouts-and-pages` - 页面拆分组织建议。

  **Acceptance Criteria**:
  - [ ] 在线编辑保存成功与冲突提示都可见。
  - [ ] 批量操作展示逐项执行结果。
  - [ ] 高风险批量删除触发 `DELETE` 文本确认。

  **QA Scenarios**:
  ```
  Scenario: 在线编辑成功保存
    Tool: Playwright
    Preconditions: 选中可编辑文本文件
    Steps:
      1. 点击 [data-testid="editor-open-btn"]
      2. 在 [data-testid="editor-textarea"] 输入 "updated-by-ui"
      3. 点击 [data-testid="editor-save-btn"]
      4. 断言 [data-testid="toast-success"] 包含 "saved"
    Expected Result: 保存成功且提示明确
    Failure Indicators: 保存按钮无响应或报错
    Evidence: .sisyphus/evidence/task-19-ui-edit-success.png

  Scenario: 批量操作部分失败可见
    Tool: Playwright
    Preconditions: 勾选 2 个有效项 + 1 个无效项
    Steps:
      1. 点击 [data-testid="batch-delete-btn"]
      2. 断言 [data-testid="batch-result-item"] 数量为 3
      3. 断言至少一个 [data-testid="batch-result-failed"]
    Expected Result: 逐项结果完整展示
    Evidence: .sisyphus/evidence/task-19-ui-batch-partial.png
  ```

  **Evidence to Capture:**
  - [ ] `task-19-ui-edit-success.png`
  - [ ] `task-19-ui-batch-partial.png`

  **Commit**: YES
  - Message: `feat(ui): add text editor and batch operation UX`

- [x] 20. 完成安全加固（SSRF/路径穿越/输入约束/最小审计）

  **What to do**:
  - 增加目标地址与端口白名单策略，阻断 SSRF 风险。
  - 增加路径规范化与权限边界检查。
  - 增加最小审计日志：连接创建/更新/删除、连接测试、批量执行。

  **Must NOT do**:
  - 不记录敏感凭据到审计日志。

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`]
    - `git-master`: 安全改动跨 API/服务/中间件多个层次
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 非前端主任务

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T21,T22,T23
  - **Blocked By**: T4,T7,T10,T16

  **References**:
  - External: `https://owasp.org/www-community/attacks/Server_Side_Request_Forgery` - SSRF 防护要点。
  - External: `https://owasp.org/www-project-logging-cheat-sheet/` - 审计日志最小可用策略。
  - Why: 该任务直接落实 Metis 给出的关键安全 guardrails。

  **Acceptance Criteria**:
  - [ ] 私网/环回等禁用目标被拦截（按配置）。
  - [ ] 审计日志可查询关键动作且不含敏感字段。

  **QA Scenarios**:
  ```
  Scenario: SSRF 目标被拒绝
    Tool: Bash (curl)
    Preconditions: 启用默认安全策略
    Steps:
      1. 创建连接 host=127.0.0.1（在禁止列表）
      2. 断言返回 error.code=TARGET_NOT_ALLOWED
    Expected Result: 请求被拒绝
    Failure Indicators: 连接创建成功
    Evidence: .sisyphus/evidence/task-20-ssrf-block.json

  Scenario: 审计日志不含敏感信息
    Tool: Bash
    Preconditions: 执行一次连接创建与测试
    Steps:
      1. 导出审计日志
      2. 检查日志包含 action/actor/timestamp
      3. 检查日志不含 password/privateKey
    Expected Result: 结构完整且安全脱敏
    Evidence: .sisyphus/evidence/task-20-audit-safe.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-20-ssrf-block.json`
  - [ ] `task-20-audit-safe.txt`

  **Commit**: YES
  - Message: `feat(security): harden validation boundaries and audit logs`

- [x] 21. 补齐自动化测试（单元 + 集成）

  **What to do**:
  - 为核心模块补齐单元测试（加密、适配器契约、路径校验、错误映射）。
  - 为 API 补齐集成测试（连接/文件主流程）。

  **Must NOT do**:
  - 不只测 happy path，必须覆盖关键失败路径。

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`]
    - `git-master`: 测试补齐会广泛触及模块边界
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 本任务非 UI 构建

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1,F2,F3,F4
  - **Blocked By**: T1,T2,T3,T4,T10,T12,T14,T15,T16,T20

  **References**:
  - Pattern: `.sisyphus/plans/ftp-webui-nodejs-v1.md` - 前置任务定义的验收场景集合。
  - External: `https://vitest.dev/` - 单元/集成测试框架规范。

  **Acceptance Criteria**:
  - [ ] `pnpm test` 通过。
  - [ ] 覆盖连接与文件关键路径的成功/失败场景。

  **QA Scenarios**:
  ```
  Scenario: 测试套件通过
    Tool: Bash
    Preconditions: 依赖安装完成
    Steps:
      1. 运行 pnpm test
      2. 断言 exit code=0
    Expected Result: 全部测试通过
    Failure Indicators: 失败用例或进程报错
    Evidence: .sisyphus/evidence/task-21-tests-pass.txt

  Scenario: 故意破坏断言可触发失败
    Tool: Bash
    Preconditions: 临时注入一个已知错误（仅测试验证）
    Steps:
      1. 运行目标测试
      2. 断言测试失败并给出可定位信息
    Expected Result: 测试具备有效防回归能力
    Evidence: .sisyphus/evidence/task-21-tests-fail-proof.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-21-tests-pass.txt`
  - [ ] `task-21-tests-fail-proof.txt`

  **Commit**: YES
  - Message: `test(core): add unit and integration coverage for v1 flows`

- [x] 22. 建立 Playwright E2E 测试场景

  **What to do**:
  - 编写连接管理、文件浏览、上传、编辑、批量操作的端到端脚本。
  - 输出截图/trace 证据，确保失败可定位。

  **Must NOT do**:
  - 不编写依赖人工观察的“弱断言”。

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]
    - `playwright`: 浏览器自动化与证据采集
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 本任务重点是验证而非视觉设计

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1,F3,F4
  - **Blocked By**: T6,T10,T12,T13,T14,T15,T16,T17,T18,T19,T20

  **References**:
  - External: `https://playwright.dev/docs/intro` - E2E 编写与 trace 规范。
  - Pattern: `.sisyphus/plans/ftp-webui-nodejs-v1.md` - T17-T19 的 UI 交互约束。

  **Acceptance Criteria**:
  - [ ] `pnpm playwright test` 可运行通过。
  - [ ] 失败时自动产出 trace 和截图。

  **QA Scenarios**:
  ```
  Scenario: E2E 主流程通过
    Tool: Bash
    Preconditions: docker compose 与应用已启动
    Steps:
      1. 运行 pnpm playwright test --project=chromium
      2. 断言通过率=100%
    Expected Result: 全场景通过
    Failure Indicators: 任一场景失败
    Evidence: .sisyphus/evidence/task-22-e2e-pass.txt

  Scenario: UI 异常时证据生成
    Tool: Bash
    Preconditions: 注入一个可控 UI 错误
    Steps:
      1. 运行对应 E2E
      2. 断言生成 trace.zip 与 screenshot
    Expected Result: 失败可追踪
    Evidence: .sisyphus/evidence/task-22-e2e-trace.txt

  Scenario: 可访问性与焦点回收
    Tool: Playwright
    Preconditions: 打开高风险删除确认弹窗
    Steps:
      1. 断言弹窗具有 role="dialog" 与 aria-modal="true"
      2. 按 Escape 关闭弹窗
      3. 断言焦点回到触发按钮 [data-testid="batch-delete-btn"]
    Expected Result: 弹窗语义与焦点管理符合规范
    Evidence: .sisyphus/evidence/task-22-a11y-dialog.txt

  Scenario: 路由切换性能门槛
    Tool: Playwright
    Preconditions: 打开 /connections 页面
    Steps:
      1. 记录切换到 /files/<connectionId> 的交互完成耗时
      2. 断言耗时 <= 800ms
    Expected Result: 路由切换满足性能阈值
    Evidence: .sisyphus/evidence/task-22-route-perf.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-22-e2e-pass.txt`
  - [ ] `task-22-e2e-trace.txt`
  - [ ] `task-22-a11y-dialog.txt`
  - [ ] `task-22-route-perf.txt`

  **Commit**: YES
  - Message: `test(e2e): add playwright scenarios for full ui flows`

- [x] 23. 执行并发与恢复烟测（10-20 活跃连接）

  **What to do**:
  - 构建 10-20 活跃连接下的连接测试、列表、传输混合压力烟测。
  - 验证超时、重试、恢复路径在目标并发内可用。

  **Must NOT do**:
  - 不将压测结果夸大为正式容量评估。

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`]
    - `git-master`: 需要可重复执行脚本与稳定结果记录
  - **Skills Evaluated but Omitted**:
    - `playwright`: 本任务以后端吞吐与稳定性为主

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1,F2,F4
  - **Blocked By**: T6,T8,T9,T10,T11,T13,T16,T19,T20

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - 并发目标为 10-20。
  - External: `https://k6.io/docs/` - 可选烟测脚本工具参考。

  **Acceptance Criteria**:
  - [ ] 在目标并发下核心接口错误率维持在可接受范围（例如 <2%）。
  - [ ] 故障注入后可自动恢复并继续处理请求。

  **QA Scenarios**:
  ```
  Scenario: 20 连接混合操作烟测
    Tool: Bash
    Preconditions: 测试脚本与容器环境就绪
    Steps:
      1. 启动 20 并发连接测试脚本（list+upload+download）
      2. 收集成功率与 P95 延迟
      3. 断言成功率>=98%
    Expected Result: 在目标并发内稳定运行
    Failure Indicators: 大量超时/连接泄漏
    Evidence: .sisyphus/evidence/task-23-concurrency-report.txt

  Scenario: 故障恢复验证
    Tool: Bash
    Preconditions: 运行并发脚本中途重启 FTP 服务
    Steps:
      1. 执行中途重启目标服务
      2. 观察重试与恢复日志
      3. 断言恢复后成功率回升到阈值
    Expected Result: 可恢复且不中断全部任务
    Evidence: .sisyphus/evidence/task-23-recovery-report.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-23-concurrency-report.txt`
  - [ ] `task-23-recovery-report.txt`

  **Commit**: YES
  - Message: `test(runtime): add concurrency and recovery smoke validation`

- [x] 24. 完成部署文档与运维回归脚本

  **What to do**:
  - 输出 Docker 单机部署、升级、备份恢复文档。
  - 编写最小回归脚本：启动检查、健康检查、关键 API 冒烟。

  **Must NOT do**:
  - 不编写依赖本地硬编码路径的不可复用脚本。

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: [`git-master`]
    - `git-master`: 文档与脚本需要与提交边界一致
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 任务核心是交付文档与运维脚本

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1,F2,F3,F4
  - **Blocked By**: T21,T22,T23

  **References**:
  - Pattern: `.sisyphus/drafts/ftp-webui-nodejs.md` - Docker 单机部署约束。
  - External: `https://docs.docker.com/compose/` - 运维命令规范。

  **Acceptance Criteria**:
  - [ ] 文档可指导从 0 到可用部署。
  - [ ] 回归脚本可一键执行并输出 pass/fail。

  **QA Scenarios**:
  ```
  Scenario: 新环境按文档部署成功
    Tool: Bash
    Preconditions: 干净环境（无运行容器）
    Steps:
      1. 按文档执行 docker compose up -d --build
      2. 执行健康检查命令
      3. 断言服务可用
    Expected Result: 文档步骤无歧义且可复现
    Failure Indicators: 文档步骤缺失或命令失败
    Evidence: .sisyphus/evidence/task-24-deploy-doc-check.txt

  Scenario: 回归脚本识别失败
    Tool: Bash
    Preconditions: 人为停止应用容器
    Steps:
      1. 执行回归脚本
      2. 断言脚本返回 non-zero 且输出失败点
    Expected Result: 脚本具备失败检测能力
    Evidence: .sisyphus/evidence/task-24-regression-failproof.txt
  ```

  **Evidence to Capture:**
  - [ ] `task-24-deploy-doc-check.txt`
  - [ ] `task-24-regression-failproof.txt`

  **Commit**: YES
  - Message: `docs(ops): add docker runbook and regression scripts`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

- [x] F1. **Plan Compliance Audit** — `oracle`
  输出: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  输出: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright`)
  输出: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  输出: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- Wave 1: `chore(scaffold): initialize nextjs ftp webui baseline`
- Wave 2: `feat(core): add protocol adapters and connection/file services`
- Wave 3: `feat(ui-api): deliver web flows for connection and file operations`
- Wave 4: `test(delivery): add automated validation and deployment runbook`

---

## Success Criteria

### Verification Commands
```bash
docker compose up -d --build
curl -s http://localhost:3000/api/health
pnpm test
pnpm playwright test
```

### Final Checklist
- [x] All Must Have present
- [x] All Must NOT Have absent
- [x] Tests pass
- [x] Evidence files complete in `.sisyphus/evidence/`
