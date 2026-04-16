# Развёртывание на VPS: [www.phyzics-eor.ru](http://www.phyzics-eor.ru)

**Сервер:** `root@5.129.199.23` (ключ SSH).  
**Репозиторий:** [https://github.com/viacheslavka0/phyzics_eor](https://github.com/viacheslavka0/phyzics_eor).  
Код клонируется в `**/srv/eora-repo`**, симлинк `**/srv/eora`** ведёт на каталог с `**manage.py**`.

**Пользователь `www-data`** — системная учётная запись Linux, под которой обычно крутятся Nginx и (в нашем примере) Gunicorn. Отдельного пользователя `eora` создавать не нужно.

---

## 1. DNS (у регистратора домена)


| Тип   | Имя                           | Значение       |
| ----- | ----------------------------- | -------------- |
| **A** | `@` (корень `phyzics-eor.ru`) | `5.129.199.23` |
| **A** | `www`                         | `5.129.199.23` |


По желанию для IPv6:

| **AAAA** | `@` | `2a03:6f00:a::1:9ae1` |
| **AAAA** | `www` | `2a03:6f00:a::1:9ae1` |

Пока DNS не указывает на этот IP, **Let’s Encrypt не выдаст сертификат**.

---

## 2. Что подготовить на сервере (один раз)

С вашего ПК скопируйте скрипт на сервер (путь к файлу у себя подставьте):

```bash
scp C:\physics\eora\deploy\vps-bootstrap-phyzics-eor.sh root@5.129.199.23:/root/
```

На сервере по SSH:

```bash
chmod +x /root/vps-bootstrap-phyzics-eor.sh
export GIT_REPO_URL='https://github.com/viacheslavka0/phyzics_eor.git'
export POSTGRES_PASSWORD='сгенерируйте_длинный_пароль'
export CERTBOT_EMAIL='ваша_почта@example.com'
# если ветка не main:
# export GIT_BRANCH='master'
# если manage.py в подкаталоге (например репозиторий = весь physics, Django в eora/):
# export EORA_PROJECT_SUBDIR='eora'

sudo -E /root/vps-bootstrap-phyzics-eor.sh
```

Флаг `**-E**` у `sudo` сохраняет переменные `GIT_REPO_URL`, `POSTGRES_PASSWORD`, `CERTBOT_EMAIL`.

Вместо `scp` можно скачать скрипт с GitHub (ветка `**main**`), если файл уже в репозитории:

- если в корне репо есть папка `**deploy/**`:  
`curl -fsSL -o /root/vps-bootstrap-phyzics-eor.sh "https://raw.githubusercontent.com/viacheslavka0/phyzics_eor/main/deploy/vps-bootstrap-phyzics-eor.sh"`
- если структура как в каталоге `**physics/eora**` на диске:  
`curl -fsSL -o /root/vps-bootstrap-phyzics-eor.sh "https://raw.githubusercontent.com/viacheslavka0/phyzics_eor/main/eora/deploy/vps-bootstrap-phyzics-eor.sh"`

Затем `chmod +x` и те же `export` + `sudo -E`.

---

## 3. Если `manage.py` не в корне репозитория

Например, в Git залит монорепозиторий, а Django в подпапке `**eora/**`:

```bash
export GIT_REPO_URL='https://github.com/viacheslavka0/phyzics_eor.git'
export EORA_PROJECT_SUBDIR='eora'
```

Скрипт клонирует в `**/srv/eora-repo**`, `**DJANGO_ROOT**` станет `**/srv/eora-repo/eora**`, симлинк `**/srv/eora**` на него укажет.

---

## 4. После скрипта

Откройте `**https://www.phyzics-eor.ru/app/**`, зайдите в админку `**/admin/**` под суперпользователем, который скрипт попросит создать в конце (или создайте вручную: `cd` в каталог проекта, `source .venv/bin/activate`, `set -a; source /etc/eora.env; set +a`, `python manage.py createsuperuser`).

**Обновление кода:** `git pull` в каталоге проекта → `pip install -r requirements.txt` → `migrate` → при изменении фронта `npm ci && npm run build` в `ui/` → `collectstatic` → `systemctl restart eora.service`.

---

## 5. Полезные команды

```bash
journalctl -u eora.service -f
nginx -t && systemctl reload nginx
```

