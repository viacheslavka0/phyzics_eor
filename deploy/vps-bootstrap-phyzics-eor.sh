#!/usr/bin/env bash
# Развёртывание ЭОР на Ubuntu для www.phyzics-eor.ru + редирект на www.
# Запуск: sudo -E bash vps-bootstrap-phyzics-eor.sh
#
# Обязательные переменные окружения:
#   GIT_REPO_URL       — HTTPS URL (проект: https://github.com/viacheslavka0/phyzics_eor.git)
#   POSTGRES_PASSWORD  — пароль пользователя БД eora_user (лучше буквы/цифры без спецсимволов)
#   CERTBOT_EMAIL      — почта для Let's Encrypt
#
# Опционально:
#   EORA_PROJECT_SUBDIR — если manage.py в подкаталоге (например eora при монорепо)
#   GIT_CLONE_DIR       — куда клонировать (по умолчанию /srv/eora-repo)
#   GIT_BRANCH          — ветка (по умолчанию main; если у вас master — задайте)
#
set -euo pipefail

: "${GIT_REPO_URL:?Укажите GIT_REPO_URL}"
: "${POSTGRES_PASSWORD:?Укажите POSTGRES_PASSWORD}"
: "${CERTBOT_EMAIL:?Укажите CERTBOT_EMAIL}"

export DEBIAN_FRONTEND=noninteractive

GIT_CLONE_DIR="${GIT_CLONE_DIR:-/srv/eora-repo}"
GIT_BRANCH="${GIT_BRANCH:-main}"
EORA_PROJECT_SUBDIR="${EORA_PROJECT_SUBDIR:-}"
DOMAIN_ROOT="phyzics-eor.ru"
DOMAIN_WWW="www.phyzics-eor.ru"
DB_NAME="eora_db"
DB_USER="eora_user"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Запустите от root: sudo -E bash $0" >&2
  exit 1
fi

# Частые сбои apt на VPS (IPv6 / «mirror sync» у archive.ubuntu.com)
mkdir -p /etc/apt/apt.conf.d
if [[ ! -f /etc/apt/apt.conf.d/99force-ipv4 ]]; then
  echo 'Acquire::ForceIPv4 "true";' >/etc/apt/apt.conf.d/99force-ipv4
fi

echo "==> apt: базовые пакеты"
# Обход «Mirror sync in progress» / битых индексов archive.ubuntu.com (часто на VPS Timeweb)
if grep -rE 'archive\.ubuntu\.com|security\.ubuntu\.com' /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null | grep -q .; then
  echo "==> apt: переключение на mirror.timeweb.ru"
  shopt -s nullglob
  for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources /etc/apt/sources.list.d/*.list; do
    [[ -f "$f" ]] || continue
    sed -i \
      -e 's|http://archive.ubuntu.com/ubuntu|http://mirror.timeweb.ru/ubuntu|g' \
      -e 's|https://archive.ubuntu.com/ubuntu|http://mirror.timeweb.ru/ubuntu|g' \
      -e 's|http://security.ubuntu.com/ubuntu|http://mirror.timeweb.ru/ubuntu|g' \
      -e 's|https://security.ubuntu.com/ubuntu|http://mirror.timeweb.ru/ubuntu|g' \
      "$f"
  done
  shopt -u nullglob
  apt-get clean
  rm -rf /var/lib/apt/lists/*
fi

apt-get update -y
apt-get install -y \
  python3 python3-venv python3-pip \
  nginx git curl ca-certificates \
  postgresql postgresql-contrib \
  certbot openssl ufw

echo "==> firewall (ufw)"
ufw allow OpenSSH || true
ufw allow "Nginx Full" || true
ufw --force enable || true

echo "==> PostgreSQL: пользователь и база"
escape_sql() { printf '%s' "$1" | sed "s/'/''/g"; }
EPASS="$(escape_sql "${POSTGRES_PASSWORD}")"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER ${DB_USER} WITH PASSWORD '${EPASS}';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER ${DB_USER} WITH PASSWORD '${EPASS}';"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi

export POSTGRES_PASSWORD
ENC_PASS="$(python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.environ['POSTGRES_PASSWORD'], safe=''))")"
DATABASE_URL="postgres://${DB_USER}:${ENC_PASS}@127.0.0.1:5432/${DB_NAME}"

echo "==> git clone (ветка ${GIT_BRANCH})"
rm -rf "${GIT_CLONE_DIR}"
git clone --depth 1 -b "${GIT_BRANCH}" "${GIT_REPO_URL}" "${GIT_CLONE_DIR}"

if [[ -n "${EORA_PROJECT_SUBDIR}" ]]; then
  DJANGO_ROOT="${GIT_CLONE_DIR}/${EORA_PROJECT_SUBDIR}"
else
  DJANGO_ROOT="${GIT_CLONE_DIR}"
fi

if [[ ! -f "${DJANGO_ROOT}/manage.py" ]]; then
  echo "Не найден ${DJANGO_ROOT}/manage.py. Задайте EORA_PROJECT_SUBDIR или проверьте структуру репозитория." >&2
  exit 1
fi

ln -sfn "${DJANGO_ROOT}" /srv/eora

echo "==> requirements.txt: UTF-8 (обход UTF-16 из PowerShell на Windows)"
export DJANGO_ROOT_FIX="${DJANGO_ROOT}"
python3 <<'PYREQ'
from pathlib import Path
import os

root = Path(os.environ["DJANGO_ROOT_FIX"])
p = root / "requirements.txt"
if not p.exists():
    raise SystemExit(0)
raw = p.read_bytes()
text = None
if raw.startswith(b"\xff\xfe"):
    text = raw[2:].decode("utf-16-le")
elif raw.startswith(b"\xfe\xff"):
    text = raw[2:].decode("utf-16-be")
elif b"\x00" in raw[: min(800, len(raw))] and b"==" in raw[: min(800, len(raw))]:
    text = raw.decode("utf-16-le", errors="replace")
if text is not None:
    text = text.replace("\r\n", "\n").replace("\r", "\n").lstrip("\ufeff")
    p.write_text(text.strip() + "\n", encoding="utf-8", newline="\n")
    print("requirements.txt перекодирован в UTF-8")
PYREQ

echo "==> venv и pip"
python3 -m venv "${DJANGO_ROOT}/.venv"
"${DJANGO_ROOT}/.venv/bin/pip" install --upgrade pip
"${DJANGO_ROOT}/.venv/bin/pip" install -r "${DJANGO_ROOT}/requirements.txt"

echo "==> Node.js (если нет собранного static/app)"
if [[ ! -f "${DJANGO_ROOT}/static/app/index.html" ]] && [[ -d "${DJANGO_ROOT}/ui" ]]; then
  echo "==> NodeSource 20.x + сборка UI"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  (cd "${DJANGO_ROOT}/ui" && npm ci && npm run build)
fi

DJANGO_SECRET_KEY="$(openssl rand -base64 48 | tr -d '\n' | tr '/+' '_-')"

echo "==> /etc/eora.env"
umask 077
cat >/etc/eora.env <<ENV
DJANGO_SETTINGS_MODULE=eora.settings
DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=${DOMAIN_WWW},${DOMAIN_ROOT}
DJANGO_CSRF_TRUSTED_ORIGINS=https://${DOMAIN_WWW},https://${DOMAIN_ROOT}
DATABASE_URL=${DATABASE_URL}
ENV
chmod 600 /etc/eora.env

install -d -o www-data -g www-data -m 775 "${DJANGO_ROOT}/media"
chown -R www-data:www-data "${GIT_CLONE_DIR}"

echo "==> migrate + collectstatic"
sudo -u www-data bash -c "
  set -a
  source /etc/eora.env
  set +a
  cd '${DJANGO_ROOT}'
  .venv/bin/python manage.py migrate --noinput
  .venv/bin/python manage.py collectstatic --noinput
"

echo "==> systemd: eora.service"
cat >/etc/systemd/system/eora.service <<UNIT
[Unit]
Description=EORA Django (Gunicorn)
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=${DJANGO_ROOT}
EnvironmentFile=/etc/eora.env
ExecStart=${DJANGO_ROOT}/.venv/bin/gunicorn eora.wsgi:application \\
  --bind 127.0.0.1:8000 \\
  --workers 3 \\
  --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now eora.service

mkdir -p /var/www/certbot
chown www-data:www-data /var/www/certbot

echo "==> Nginx: фаза HTTP (webroot + прокси для первого запуска)"
cat >/etc/nginx/sites-available/eora <<'NGINX_HTTP'
# Временная конфигурация до certbot (HTTP + ACME webroot)
server {
    listen 80;
    listen [::]:80;
    server_name phyzics-eor.ru www.phyzics-eor.ru;

    client_max_body_size 25M;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location /static/ {
        alias DJANGO_ROOT_PLACEHOLDER/static_collected/;
        access_log off;
        expires 7d;
    }

    location /media/ {
        alias DJANGO_ROOT_PLACEHOLDER/media/;
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_HTTP
sed -i "s|DJANGO_ROOT_PLACEHOLDER|${DJANGO_ROOT}|g" /etc/nginx/sites-available/eora

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/eora /etc/nginx/sites-enabled/eora
nginx -t
systemctl reload nginx

echo "==> Let's Encrypt (webroot)"
certbot certonly --webroot -w /var/www/certbot \
  -d "${DOMAIN_WWW}" -d "${DOMAIN_ROOT}" \
  --email "${CERTBOT_EMAIL}" --agree-tos --non-interactive --rsa-key-size 4096

LIVE="/etc/letsencrypt/live/${DOMAIN_WWW}"

if [[ ! -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
  echo "==> openssl dhparam (один раз, быстрый режим -dsaparam)"
  openssl dhparam -dsaparam -out /etc/letsencrypt/ssl-dhparams.pem 2048
fi

echo "==> Nginx: HTTPS + редирект корня на www"
cat >/etc/nginx/sites-available/eora <<NGINX_SSL
# HTTP → редирект на https://www
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_ROOT} ${DOMAIN_WWW};

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://${DOMAIN_WWW}\$request_uri;
    }
}

# HTTPS: корень домена → www
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN_ROOT};

    ssl_certificate     ${LIVE}/fullchain.pem;
    ssl_certificate_key ${LIVE}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://${DOMAIN_WWW}\$request_uri;
}

# Основной сайт
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN_WWW};

    ssl_certificate     ${LIVE}/fullchain.pem;
    ssl_certificate_key ${LIVE}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 25M;

    location /static/ {
        alias ${DJANGO_ROOT}/static_collected/;
        access_log off;
        expires 7d;
    }

    location /media/ {
        alias ${DJANGO_ROOT}/media/;
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_SSL

nginx -t
systemctl reload nginx

echo
echo "Готово. Проверьте: https://${DOMAIN_WWW}/app/"
echo "Создайте суперпользователя (интерактивно):"
echo "  sudo -u www-data bash -lc 'set -a; source /etc/eora.env; set +a; cd ${DJANGO_ROOT} && .venv/bin/python manage.py createsuperuser'"
echo
