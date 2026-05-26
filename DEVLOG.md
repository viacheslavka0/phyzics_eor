# EORA — Devlog

> Этот файл ведётся Claude. Каждое изменение фиксируется здесь + git commit.
> В начале новой сессии — читаю его первым делом.

---

## 2026-05-26 — UX/UI Session 2 завершён + документация

### Задеплоено на сервер ✅
- Commit: `dac6609` — UX/UI Session 2: sidebar redesign, stage transitions, completion screen
- Сервер: `root@5.129.199.23`, сервис `eora.service`
- Deploy: `rsync static/app/ → /srv/eora-repo/eora/static/app/` + `collectstatic`
- Python: `/srv/eora-repo/eora/.venv`, env: `/etc/eora.env`

### Что сделано (Session 2 завершение)

#### Фронтенд (App.jsx + index.css)
- **Сайдбар:** тёмный (bg-slate-900) → светлый (bg-white/95 backdrop-blur-sm border-r border-slate-200/60)
  - Все тексты: `text-white` → `text-slate-900`, `text-slate-300` → `text-slate-500`
  - Hover: `hover:bg-slate-700` → `hover:bg-slate-100`
  - Изумруд акценты: `text-emerald-400` → `text-emerald-600`
- **Мобильный топбар:** тёмный → светлый (same theme)
- **Смена этапов:** добавлен `key={stage}` + `.stage-container` animation → плавный slide-up
- **Неверный ответ:** `.feedback-wrong.animate-shake` карточка с вибрацией
- **StageCompleted:** `.celebration-ring` + `animate-bounceIn` + staggered текст
- **Portal.jsx:** двухколоночный layout (левая: branding, правая: форма)

#### Backend (services.py, views.py)
- **Bug fix:** исправлена проверка cloze — использование `ks.clozes` вместо `ks.ks_cloze_blanks`
- **Bug fix:** конвертация `mappings` из списка в dict перед передачей в сервис

#### Документация (CLAUDE.md)
- Добавлены разделы с известными багами (Bug #1-#4):
  - `KSCloze` структура и правильный способ получить blanks
  - Mismatch формата `mappings` (list vs dict)
  - Python 3.9 совместимость (`Optional` вместо `|`)
  - Unicode escape в JSX placeholder

### Полный чеклист Session 2 ✅
- [x] Сайдбар светлый (не тёмный)
- [x] Плавные переходы между этапами
- [x] Анимация неправильного ответа (shake)
- [x] Экран завершения с celebration
- [x] Portal.jsx двухколоночный
- [x] Документация багов в CLAUDE.md
- [x] Backend fixes (cloze, mappings)
- [x] Git commit + push на GitHub

---

## Шаблон для следующих записей

```
## YYYY-MM-DD — Краткое описание

### Файлы изменены
- `путь/к/файлу.py` — что именно

### Задеплоено
- [ ] build: `npx vite build --mode development`
- [ ] rsync: `rsync static/app/ → сервер`
- [ ] collectstatic: OK
- [ ] restart: `systemctl restart eora`

### Git
- `git add -A && git commit -m "описание"`
```
