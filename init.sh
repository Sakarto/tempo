#!/usr/bin/env bash
# Idempotent dev setup: install deps if missing, start the dev server in the background, wait until it answers.
# Fill in the three variables for this project; leave the rest alone.
set -euo pipefail

INSTALL_CMD="npm ci"            # e.g. "pip install -r requirements.txt"
DEV_CMD="npm run dev -- --port 5173 --strictPort"           # e.g. "uvicorn app.main:app --port 3000"
HEALTH_URL="http://localhost:5173"

cd "$(dirname "$0")"

if [ -f package.json ] && [ ! -d node_modules ]; then $INSTALL_CMD; fi
if [ -f requirements.txt ] && [ ! -d .venv ]; then python3 -m venv .venv && . .venv/bin/activate && $INSTALL_CMD; fi

if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  echo "dev server already running at $HEALTH_URL"; exit 0
fi

nohup $DEV_CMD > .dev-server.log 2>&1 &
for _ in $(seq 1 60); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then echo "dev server up at $HEALTH_URL"; exit 0; fi
  sleep 1
done
echo "dev server did not respond within 60 s; last log lines:" >&2
tail -n 40 .dev-server.log >&2
exit 1
