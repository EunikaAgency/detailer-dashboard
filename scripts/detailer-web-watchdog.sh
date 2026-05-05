#!/usr/bin/env bash
set -u

export HOME="/home/eunika-yellow"
export PM2_HOME="${HOME}/.pm2"
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

APP_DIR="/var/www/node/detailer-dashboard"
LOG_FILE="/tmp/detailer-web-watchdog.log"
LOCK_FILE="/tmp/detailer-web-watchdog.lock"
PM2_BIN="/usr/bin/pm2"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

cd "$APP_DIR" || {
  log "Cannot cd to $APP_DIR"
  exit 1
}

ensure_build() {
  if [ -f "$APP_DIR/.next/BUILD_ID" ]; then
    return 0
  fi

  log "Missing .next/BUILD_ID; running npm run build before starting production"
  if npm run build >> "$LOG_FILE" 2>&1; then
    log "Build completed"
    return 0
  fi

  log "Build failed"
  return 1
}

pm2_web_apps_online() {
  local state_file="/tmp/detailer-web-watchdog-pm2.json"
  "$PM2_BIN" jlist > "$state_file" 2>/dev/null || return 1

  node - "$state_file" <<'NODE'
const fs = require("fs");
const statePath = process.argv[2];
const apps = JSON.parse(fs.readFileSync(statePath, "utf8"));
const required = new Set(["detailer-web-dev", "detailer-web-prod"]);
for (const app of apps) {
  if (required.has(app?.name) && app?.pm2_env?.status === "online") {
    required.delete(app.name);
  }
}
process.exit(required.size === 0 ? 0 : 1);
NODE
}

port_is_listening() {
  ss -ltn | grep -Eq "[*:.:]$1[[:space:]]"
}

http_is_healthy() {
  local port="$1"
  local status
  status="$(curl -o /dev/null -sS -w "%{http_code}" --max-time 10 "http://127.0.0.1:${port}/dashboard/reports" || printf '000')"
  case "$status" in
    2*|3*|401|403) return 0 ;;
    *) return 1 ;;
  esac
}

restart_ecosystem() {
  local reason="$1"
  log "Restarting PM2 ecosystem: $reason"

  ensure_build || return 1

  "$PM2_BIN" resurrect >> "$LOG_FILE" 2>&1 || true
  "$PM2_BIN" startOrRestart ecosystem.config.js >> "$LOG_FILE" 2>&1 || "$PM2_BIN" start ecosystem.config.js >> "$LOG_FILE" 2>&1
  "$PM2_BIN" save >> "$LOG_FILE" 2>&1 || true
}

reasons=()

if ! pm2_web_apps_online; then
  reasons+=("web apps missing or not online in PM2")
fi

for port in 7000 7001; do
  if ! port_is_listening "$port"; then
    reasons+=("port ${port} is not listening")
  elif ! http_is_healthy "$port"; then
    reasons+=("port ${port} failed HTTP health check")
  fi
done

if [ "${#reasons[@]}" -gt 0 ]; then
  restart_ecosystem "${reasons[*]}"
fi
