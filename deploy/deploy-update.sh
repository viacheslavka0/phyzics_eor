#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/eora-repo/eora"
REPO_DIR="/srv/eora-repo"
ENV_FILE="/etc/eora.env"
SERVICE="eora.service"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

cd "$REPO_DIR"
echo "==> git pull"
git pull --ff-only

cd "$APP_DIR"
echo "==> install requirements"
.venv/bin/pip install -r requirements.txt

echo "==> migrate + collectstatic"
set -a
source "$ENV_FILE"
set +a
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput

echo "==> restart service"
systemctl restart "$SERVICE"
systemctl --no-pager --full status "$SERVICE" | sed -n '1,12p'

echo "==> done"
