# EORA — Devlog

> Этот файл ведётся Claude. Каждое изменение фиксируется здесь + git commit.
> В начале новой сессии — читаю его первым делом.

---

## 2026-05-23 — Текущее состояние (после initial commit)

### Задеплоено на сервер ✅
- Сервер: `root@5.129.199.23`, сервис `eora.service`
- Deploy: `rsync static/app/ → /srv/eora-repo/eora/static/app/` + `collectstatic`
- Python: `/srv/eora-repo/eora/.venv`, env: `/etc/eora.env`

### Что сделано (хронологически)

#### Модель и API
- `learning/models.py` — добавлено поле `Task.illustration` (ImageField, `tasks/illustrations/`)
- `learning/migrations/0023_task_illustration.py` — миграция применена на сервере
- `learning/views.py` — добавлен `illustration_url` в ответ `next_task` API
- `learning/views.py` — добавлены экшены `upload_illustration` и `delete_illustration` в `TeacherTaskViewSet`
- `learning/serializers.py` — добавлено поле `illustration_url` в `TaskDetailSerializer` и `TaskListSerializer`

#### Панель учителя (TeacherApp.jsx)
- Редактор зон: drag-to-move + 8 ручек resize + числовые поля X/Y/W/H
- Компонент `TaskIllustrationUploader` — загрузка/удаление иллюстрации к задаче

#### Студенческий интерфейс (App.jsx + index.css)
- **Дизайн (index.css):** новые keyframes (shake, bounceIn, slideUp, stageEnter, toastIn/Out)
  анимации-классы (.animate-shake, .animate-bounceIn, .animate-slideUp, .stage-container)
  прогресс-бар: height 0.55rem → 0.85rem, spring easing
  `.eora-screen-header` — карточный стиль вместо левой границы
  `.feedback-wrong`, `.feedback-correct`, `.celebration-ring` — новые утилиты
- **Сайдбар:** тёмный (bg-slate-900) → светлый (bg-white/95 backdrop-blur)
- **Мобильный топбар:** тёмный → светлый
- **StageProgress:** bg-slate-800 → bg-slate-50, все тексты обновлены
- **Смена этапа:** `key={stage}` + `.stage-container` → плавный slide-up
- **Неверный ответ:** `.feedback-wrong.animate-shake` вместо простого bg-red-50
- **StageCompleted:** `.celebration-ring` + `animate-bounceIn` + staggered `animate-slideUp`
- **Карточка задачи (StageTaskList):** вписана иллюстрация справа/снизу, убраны дубли
- **Пооперационный контроль (StageStepByStep):**
  - Три нумерации → одна (кружки + полоса в одном блоке, убран синий квадрат)
  - Аффорданс: пунктирное подчёркивание на кликабельных словах
  - Унификация: text_pick и symbol — один indigo цвет
  - Вердикт: «Совпадает ли ваш ответ с эталоном?» вместо «Какой вариант принимаете?»

### Что НЕ сделано (из плана rustling-weaving-moore.md)
- ❌ `Toast.jsx` — замена alert() на всплывающие уведомления
- ❌ `Portal.jsx` — двухколоночный экран входа
- ❌ `tailwind.config.js` — keyframes для JIT purge

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
