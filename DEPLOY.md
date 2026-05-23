# Гайд: публикация ЭОР (Django + React) на VPS

Документ описывает **полный путь**: что купить, как подготовить сервер и как запустить проект **eora** так, чтобы по ссылке `https://ваш-домен` открывалось приложение ученика (`/app/`), API работало, медиа открывались, без «провисаний» при десятке одновременных пользователей.

**Стек проекта (важно для шагов):**

- Backend: **Django**, точка входа WSGI `eora.wsgi:application`
- Фронт: собирается **Vite** из каталога `ui/` → файлы попадают в **`static/app/`**
- В разработке: **SQLite**; **для продакшена рекомендуется PostgreSQL** (параллельные записи сессий/ответов)
- Сейчас в `eora/settings.py`: `DEBUG=True`, статика для Django в DEBUG подключается в `urls.py`; **при `DEBUG=False` статику и медиа должен отдавать Nginx** (ниже — готовый фрагмент конфига)

---

## Часть 1. Что купить и где

### 1.1. VPS (это и есть «хостинг» для Django)

Нужен **виртуальный сервер (VPS)** с **Ubuntu 22.04 LTS** (или 24.04).

**Ориентир по ресурсам** для спокойного теста ~20 учеников + учитель:

| Ресурс | Минимум | Комфортнее |
|--------|---------|------------|
| RAM    | 2 GB    | 2–4 GB     |
| CPU    | 1 vCPU  | 2 vCPU     |
| Диск   | SSD 25–40 GB | SSD |

**Провайдеры (на выбор):** Timeweb, Selectel, REG.Cloud, Hetzner (если удобна оплата картой и сервер в ЕС). Можно **домен + VPS в одном личном кабинете** — проще первый раз.

### 1.2. Домен

**Желательно купить домен** (любая недорогая зона: `.site`, `.online`, `.ru` и т.д.), чтобы:

- дать людям **человеческую ссылку**;
- включить **HTTPS** (Let’s Encrypt выдаёт сертификат на **имя домена**, не на «голый» IP).

После покупки в панели регистратора в разделе **DNS** создайте запись:

- тип **A**;
- имя **`@`** (корень) или **`www`** / **`demo`** (если хотите `demo.домен.ru`);
- значение — **публичный IPv4** вашего VPS.

Распространение DNS: от **нескольких минут до пары часов**.

---

## Часть 2. Подготовка на вашем компьютере (перед выкладкой)

### 2.1. Собрать фронтенд

В каталоге проекта:

```bash
cd ui
npm ci
npm run build
```

Убедитесь, что появились/обновились файлы в **`eora/static/app/`** (там `index.html` и `assets/`).

Дальше на сервере (или локально перед выкладкой) соберите статику для **админки** и единый каталог под Nginx:

```bash
cd /srv/eora   # или корень проекта на ПК
source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
export DJANGO_SECRET_KEY=...  # любой ключ для команды; на сервере возьмите из /etc/eora.env
export DJANGO_DEBUG=False
export DJANGO_ALLOWED_HOSTS=demo.ваш-домен.ru
python manage.py collectstatic --noinput
```

В **`eora/settings.py`** задано **`STATIC_ROOT = static_collected/`** — в Nginx указывайте **`alias .../static_collected/`** (см. пример **`deploy/nginx-site.conf`**).

### 2.2. Зафиксировать зависимости Python

В корне `eora` (где `manage.py`) выполните в активированном venv с рабочим проектом:

```bash
pip freeze > requirements.txt
```

Файл **`requirements.txt`** положите в репозиторий и используйте на сервере. Минимально для прод обычно нужны: `Django`, `djangorestframework`, `django-cors-headers`, `gunicorn`, `psycopg2-binary`, при использовании картинок — `Pillow`.

**Важно — делайте `freeze` из виртуального окружения проекта**, а не из «голого» системного Python:

```powershell
cd C:\physics\eora
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install django djangorestframework django-cors-headers gunicorn psycopg2-binary pillow
# при необходимости добавьте пакеты, без которых не стартует manage.py
python manage.py check
pip freeze > requirements.txt
```

Так в `requirements.txt` попадут только зависимости ЭОР, а не всё, что когда-то ставили в Windows.

**Предупреждение `Ignoring invalid distribution ~orch`** — это не ошибка команды: в **глобальной** папке `site-packages` лежит **битая/недоустановленная** директория (часто остаток **`torch`** — имя обрезано до `~orch`). Pip её **просто пропускает**, файл `requirements.txt` обычно всё равно создаётся.

- Если `freeze` делали **без venv** — список может быть **огромным** и не подходить для сервера; лучше повторить через **`.venv`**, как выше.
- Чтобы убрать предупреждение в системном Python: в «Программы и компоненты» / переустановка **PyTorch**, либо аккуратно удалить только папку `~orch*` в  
  `C:\Users\...\Python312\Lib\site-packages`  
  (только если понимаете, что там не нужен рабочий пакет; при сомнении — не трогайте, venv для ЭОР достаточно).

### 2.3. Прод-настройки Django (обязательно до публикации)

Сейчас в `eora/settings.py` захардкожены **небезопасные** значения для интернета:

- `SECRET_KEY` — в проде должен быть **уникальный длинный** ключ из переменной окружения;
- `DEBUG = True` — в проде **`False`**;
- `ALLOWED_HOSTS = []` — в проде указать **`ваш-домен`** и при необходимости IP;
- `DATABASES` — в проде **PostgreSQL**, не SQLite;
- при HTTPS включите безопасные cookie (см. документацию Django: `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`).

**Практичный способ без полного рефакторинга:** вынести чувствительные параметры в **`os.environ`** и задать их в **systemd** или в файле `/etc/eora.env` (права `600`, только root).

Пример переменных (имена можете выбрать свои):

```bash
DJANGO_SECRET_KEY=...сгенерируйте_случайную_строку...
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=demo.ваш-домен.ru
DATABASE_URL=postgres://eora_user:НАДЁЖНЫЙ_ПАРОЛЬ@127.0.0.1:5432/eora_db
```

Сгенерировать ключ (на сервере или локально):

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**Важно:** после правок `settings.py` проверьте локально `python manage.py check` и что приложение стартует с `DEBUG=False` и вашим доменом в `ALLOWED_HOSTS`.

---

## Часть 3. Первый вход на сервер

1. В панели VPS скопируйте **IP**, **логин** (часто `root` или `ubuntu`) и способ входа (**SSH-ключ** предпочтительнее пароля).
2. С локального ПК (Windows — PowerShell или установленный OpenSSH):

```bash
ssh ubuntu@ВАШ_IP
```

3. Обновите систему:

```bash
sudo apt update && sudo apt upgrade -y
```

4. Включите firewall (порты 22, 80, 443):

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Часть 4. Установка ПО на сервере

```bash
sudo apt install -y python3 python3-venv python3-pip nginx git certbot python3-certbot-nginx postgresql postgresql-contrib
```

---

## Часть 5. PostgreSQL

```bash
sudo -u postgres psql
```

В консоли `psql`:

```sql
CREATE USER eora_user WITH PASSWORD 'придумайте_длинный_пароль';
CREATE DATABASE eora_db OWNER eora_user;
\q
```

Дальше в Django укажите эту БД (через `DATABASES` из env или отдельный блок в `settings` для прод).

---

## Часть 6. Код проекта на сервере

Варианты:

- **Git:** `git clone` вашего репозитория в например `/srv/eora`;
- **Копирование:** архив с ПК + `scp`/`rsync`.

Рабочий каталог в примерах ниже: **`/srv/eora`** (корень репозитория, где лежит `manage.py`).

```bash
sudo mkdir -p /srv/eora
sudo chown $USER:$USER /srv/eora
cd /srv/eora
# git clone ... или распаковка архива
```

Виртуальное окружение и зависимости:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Миграции и статический контент Django (если включите `collectstatic` в проде — опционально; у вас основной UI уже в `static/app/` от Vite):

```bash
export DJANGO_SETTINGS_MODULE=eora.settings
# задайте все нужные переменные окружения для БД и SECRET_KEY
python manage.py migrate
python manage.py createsuperuser
```

Создайте каталог для загрузок:

```bash
mkdir -p /srv/eora/media
```

---

## Часть 7. Gunicorn

Установка уже в venv: `gunicorn`. Проверка вручную:

```bash
cd /srv/eora
source .venv/bin/activate
gunicorn eora.wsgi:application --bind 127.0.0.1:8000 --workers 3
```

Если страница не открывается снаружи — это нормально: снаружи будет **Nginx**.

**Юнит systemd** `/etc/systemd/system/eora.service` (подставьте пользователя `www-data` или отдельного пользователя `eora` — тогда выставьте права на `/srv/eora`):

```ini
[Unit]
Description=EORA Django (Gunicorn)
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/srv/eora
EnvironmentFile=/etc/eora.env
ExecStart=/srv/eora/.venv/bin/gunicorn eora.wsgi:application \
  --bind 127.0.0.1:8000 \
  --workers 3 \
  --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
```

Файл **`/etc/eora.env`** (права `chmod 600`), пример строк:

```env
DJANGO_SETTINGS_MODULE=eora.settings
# сюда же — SECRET_KEY, DEBUG=False, ALLOWED_HOSTS, параметры БД,
# если вы их читаете из os.environ в settings.py
```

Запуск:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now eora.service
sudo systemctl status eora.service
```

---

## Часть 8. Nginx + статика + медиа + HTTPS

Создайте сайт **`/etc/nginx/sites-available/eora`** (замените `demo.ваш-домен.ru` и пути):

```nginx
server {
    listen 80;
    server_name demo.ваш-домен.ru;

    client_max_body_size 25M;

    location /static/ {
        alias /srv/eora/static_collected/;
        access_log off;
        expires 7d;
    }

    location /media/ {
        alias /srv/eora/media/;
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
```

Включите сайт и перезапустите Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/eora /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**HTTPS (Let's Encrypt):**

```bash
sudo certbot --nginx -d demo.ваш-домен.ru
```

Certbot сам допишет `listen 443 ssl` и пути к сертификатам. Проверьте автообновление:

```bash
sudo certbot renew --dry-run
```

---

## Часть 9. Проверка сценария «как у ученика»

1. Откройте в браузере **`https://demo.ваш-домен.ru/app/`** (или ваш путь — в проекте шаблон `index.html` отдаётся с `/app/`).
2. Войдите под пользователем, которого создали в админке или через `createsuperuser` + обычные пользователи.
3. Пройдите один полный сценарий (сессия, ответ, загрузка картинки если нужно).
4. Админка: **`https://demo.ваш-домен.ru/admin/`** — только для учителя/админа.

---

## Часть 10. Обновление сайта после правок в коде

На **вашем ПК**: `git commit`, сборка фронта `npm run build`, пуш в репозиторий.

На **сервере**:

```bash
cd /srv/eora
git pull
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
sudo systemctl restart eora.service
```

Если менялся только фронт — достаточно обновить файлы в `static/app/` и при необходимости сбросить кэш CDN/браузера.

---

## Часть 11. Резервные копии и логи

- **БД:** ежедневный `pg_dump` в файл + копирование на другое место.
- **Медиа:** `rsync` или снимок диска.
- **Логи:** `journalctl -u eora.service -f`, логи Nginx в `/var/log/nginx/`.

---

## Чеклист перед тем как давать ссылку людям

- [ ] Домен указывает на IP VPS (запись **A**)
- [ ] `certbot` выдал сертификат, сайт открывается по **https**
- [ ] `DEBUG=False`, свой **`SECRET_KEY`**, заполнен **`ALLOWED_HOSTS`**
- [ ] База **PostgreSQL**, миграции применены
- [ ] Gunicorn в **systemd** и **active**
- [ ] Nginx отдаёт **`/static/`** и **`/media/`**
- [ ] Созданы учётные записи учеников (без публичной регистрации)
- [ ] Сделан пробный проход сценария обучения

---

## Если что-то пошло не так

| Симптом | Куда смотреть |
|---------|----------------|
| 502 Bad Gateway | `journalctl -u eora.service -n 50`, ошибки в Gunicorn |
| Статика/CSS не грузится | Путь `alias` в Nginx на **`static_collected/`**, выполнен **`collectstatic`** после **`npm run build`** |
| 400 CSRF | `CSRF_TRUSTED_ORIGINS`, совпадение домена и схемы https |
| Медиа 404 | Права на `/srv/eora/media/`, блок `location /media/` |
| «Тормозит» при одновременной работе | Переход с SQLite на Postgres, увеличение RAM, число workers Gunicorn |

---

*Документ составлен под структуру репозитория `eora` (Django-проект в корне, UI в `ui/`, раздача приложения с `/app/`). При изменении путей или `settings.py` обновите соответствующие шаги.*
