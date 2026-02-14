#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RESULTS_FILE="${RESULTS_FILE:-/Users/ahmedraza/downloads/results (1).jsonl}"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-3001}"
APP_BASE_URL="http://${APP_HOST}:${APP_PORT}"

TMP_DIR="$ROOT_DIR/.tmp"
PID_FILE="$TMP_DIR/dev-${APP_PORT}.pid"
LOG_FILE="$TMP_DIR/dev-${APP_PORT}.log"

log() {
  printf '[bootstrap] %s\n' "$1"
}

ensure_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

ensure_cmd node
ensure_cmd npm
ensure_cmd curl

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  echo "Required command not found: docker-compose or docker compose" >&2
  exit 1
fi

if [[ ! -f "$RESULTS_FILE" ]]; then
  echo "Results file not found: $RESULTS_FILE" >&2
  exit 1
fi

mkdir -p "$TMP_DIR"

if command -v colima >/dev/null 2>&1; then
  if ! colima status >/dev/null 2>&1; then
    log "Starting Colima..."
    colima start
  else
    log "Colima is already running."
  fi
fi

log "Starting PostgreSQL container..."
$COMPOSE_CMD up -d db

log "Waiting for PostgreSQL readiness..."
for i in {1..90}; do
  if $COMPOSE_CMD exec -T db pg_isready -U postgres -d student_activity >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 90 ]]; then
    echo "PostgreSQL did not become ready in time." >&2
    exit 1
  fi
  sleep 1
done

log "Applying Prisma migrations..."
npx prisma migrate deploy

log "Importing cleaned results from: $RESULTS_FILE"
node --experimental-strip-types scripts/import-results-jsonl.ts "$RESULTS_FILE"

log "Cleaning duplicate legacy result entries..."
node --experimental-strip-types scripts/cleanup-import-duplicates.ts

log "Running lint..."
npm run lint

log "Running production build (webpack mode)..."
npm run build -- --webpack

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" >/dev/null 2>&1; then
    log "Stopping previous dev server PID $OLD_PID..."
    kill "$OLD_PID" || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

if lsof -iTCP:"$APP_PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  log "Port $APP_PORT is in use. Stopping existing listener(s)..."
  PIDS_ON_PORT="$(lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN || true)"
  if [[ -n "$PIDS_ON_PORT" ]]; then
    # shellcheck disable=SC2086
    kill $PIDS_ON_PORT || true
    sleep 1
  fi
fi

if lsof -iTCP:"$APP_PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "Port $APP_PORT is still in use after attempted cleanup." >&2
  exit 1
fi

log "Starting application at ${APP_BASE_URL}..."
nohup npm run dev -- --webpack --hostname "$APP_HOST" --port "$APP_PORT" >"$LOG_FILE" 2>&1 &
APP_PID=$!
echo "$APP_PID" > "$PID_FILE"

log "Waiting for application startup..."
for i in {1..90}; do
  if curl -fsS "$APP_BASE_URL/api/health" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 90 ]]; then
    echo "Application did not become ready in time." >&2
    tail -n 120 "$LOG_FILE" || true
    exit 1
  fi
  sleep 1
done

log "Running endpoint verification..."
APP_BASE_URL="$APP_BASE_URL" node --experimental-strip-types scripts/verify-app.ts

log "Completed successfully."
log "App URL: $APP_BASE_URL"
log "Dev server PID: $APP_PID"
log "Dev server log: $LOG_FILE"
log "Import report: $ROOT_DIR/scripts/reports/results-import-report.json"
