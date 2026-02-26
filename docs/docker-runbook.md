# FTP WebUI Docker 单机部署与回归手册

## 1. 前置条件

- Docker Engine >= 24
- Docker Compose Plugin >= 2.20
- 可用端口：`3000`、`21`、`21100-21110`、`2222`

## 2. 环境变量

创建 `.env`（可参考 `.env.example`）：

```bash
APP_MASTER_KEY=replace-with-strong-master-key
NODE_ENV=production
```

说明：

- `APP_MASTER_KEY` 必填，用于连接凭据加密。
- 生产环境不要设置 `ALLOW_PRIVATE_NETWORKS=true`。

## 3. 首次部署

```bash
docker compose up -d --build
docker compose ps
```

健康检查：

```bash
curl -fsS http://localhost:3000/api/health
```

期望返回：

```json
{"status":"ok", ...}
```

## 4. 升级流程

```bash
git pull
docker compose build
docker compose up -d
docker compose ps
curl -fsS http://localhost:3000/api/health
```

升级后执行回归：

```bash
bash scripts/ops/regression-smoke.sh
```

## 5. 备份与恢复

### 5.1 备份

默认 SQLite 文件在 `.data/ftp-webui.sqlite`：

```bash
mkdir -p backup
cp .data/ftp-webui.sqlite "backup/ftp-webui-$(date +%Y%m%d-%H%M%S).sqlite"
cp .env "backup/env-$(date +%Y%m%d-%H%M%S).bak"
```

### 5.2 恢复

```bash
cp backup/ftp-webui-<timestamp>.sqlite .data/ftp-webui.sqlite
cp backup/env-<timestamp>.bak .env
docker compose up -d
curl -fsS http://localhost:3000/api/health
```

## 6. 回滚策略

如果升级失败：

1. 停止服务 `docker compose down`
2. 恢复上一版本镜像或代码
3. 恢复最近可用的 `.data/ftp-webui.sqlite`
4. `docker compose up -d`
5. 运行 `bash scripts/ops/regression-smoke.sh`

## 7. 常见问题

- 健康检查失败：先看 `docker compose logs app`。
- 连接测试异常：确认目标 FTP/FTPS/SFTP 可达，且未触发 SSRF 限制。
- 端口冲突：修改 `docker-compose.yml` 映射并同步运维文档。
