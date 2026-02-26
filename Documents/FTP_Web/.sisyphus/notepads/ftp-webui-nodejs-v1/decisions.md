# Decisions - FTP WebUI Node.js V1

## Pre-Planning Decisions
- Architecture: Next.js monolith (App Router)
- Protocols: FTP + FTPS + SFTP
- User model: Single admin (V1)
- DB: SQLite (V1)
- Credential encryption: AES-256-GCM + env master key
- Visual: Dark ops dashboard (#0F172A/#1E293B/#22C55E/#020617/#F8FAFC)
- Typography: Lexend + Source Sans 3 + Noto Sans SC fallback
- Icons: Lucide SVG only
- Deployment: Docker single-node
- Concurrency target: 10-20 active connections
- Test strategy: implement first, then add automated tests
- FTP/FTPS lib: basic-ftp
- SFTP lib: ssh2-sftp-client + ssh2
- Test framework: Vitest + Supertest + Playwright
- Route convention: /connections, /files/[connectionId], /files/[connectionId]/edit?path=
- E2E selectors: data-testid first, never class-based

## T18 Decisions (2026-02-26)
- File browser page uses a single client entry (`src/app/files/[connectionId]/page.tsx`) and composes presentational subcomponents from `src/components/files/*`.
- Error handling strategy: detect 404 / `CONNECTION_NOT_FOUND` as recoverable empty state and guide users back to `/connections`.
- Upload strategy: send multipart `FormData` with `remotePath` + `file` to `/api/connections/[id]/files/upload`; refresh current directory after success.
- Download strategy: use `window.open` against `/api/connections/[id]/files/download?path=...` for browser-native streaming download.

## 2026-02-26 F4 Scope Fidelity
- Scope fidelity audit concludes `Tasks [28/28 compliant] | Contamination [CLEAN/0 issues] | VERDICT PASS`.
- Forbidden-scope keyword scan in `src/**/*.{ts,tsx}` for RBAC/SSO/multi-tenant/queue/distributed terms returned no matches.
- V1 guardrails remain aligned: single-admin model, encrypted credential storage, strict protocol validation defaults, editor small-text-file constraints.
