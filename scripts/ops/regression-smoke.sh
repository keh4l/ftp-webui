#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
CONNECTION_ID=""

pass() {
  printf '[PASS] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

request_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"

  if [[ -n "$body" ]]; then
    curl -fsS -X "$method" "$url" -H 'Content-Type: application/json' -d "$body"
  else
    curl -fsS -X "$method" "$url"
  fi
}

assert_health() {
  local payload
  payload="$(request_json GET "$BASE_URL/api/health")" || fail "健康检查请求失败"

  node -e '
    const data = JSON.parse(process.argv[1]);
    if (data.status !== "ok") process.exit(1);
  ' "$payload" || fail "健康检查返回异常: $payload"

  pass "健康检查通过"
}

assert_connections_list() {
  local payload
  payload="$(request_json GET "$BASE_URL/api/connections")" || fail "连接列表请求失败"

  node -e '
    const data = JSON.parse(process.argv[1]);
    if (!Array.isArray(data)) process.exit(1);
  ' "$payload" || fail "连接列表不是数组: $payload"

  pass "连接列表接口通过"
}

assert_validation_error() {
  local status payload
  payload="$(mktemp)"
  status="$(curl -sS -o "$payload" -w '%{http_code}' -X POST "$BASE_URL/api/connections" -H 'Content-Type: application/json' -d '{"protocol":"sftp","host":"","port":22,"username":"u","password":"p"}')"

  [[ "$status" == "400" ]] || fail "非法参数未返回 400，实际: $status"

  node -e '
    const data = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    if (data?.error?.code !== "VALIDATION_ERROR") process.exit(1);
  ' "$payload" || fail "非法参数错误码不正确"

  rm -f "$payload"
  pass "参数校验错误路径通过"
}

main() {
  assert_health
  assert_connections_list
  assert_validation_error
  pass "回归脚本全部检查通过"
}

main "$@"
