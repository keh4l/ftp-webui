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

