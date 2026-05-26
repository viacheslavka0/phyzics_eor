# EORA — Devlog

> Этот файл ведётся Claude. Каждое изменение фиксируется здесь + git commit.
> В начале новой сессии — читаю его первым делом.

---

## 2026-05-26 — Сессия 4: переписаны решения 20 задач + чистка схем + рендер эталона/клавиатура

### Бэкап прод-БД (для отката!)
- На сервере: `/srv/eora-repo/eora/backups/eora_db_20260526_201041.sql` (полный pg_dump) +
  `content_20260526_201041.json` (dumpdata: Task/TaskSolutionStep/SchemaTemplate/SolutionStep/SolutionMethod).
- Локально (gitignore): `eora/.backups/` — те же файлы + `transform.py`/`apply_prod.py` (скрипты правок).
- Откат: `loaddata content_20260526_201041.json` или `psql < eora_db_*.sql`.

### Контент (прод-БД, 40 правок)
- Шаги 5 (уравнения) и 9 (расчёт) всех 20 задач переписаны в тетрадный LaTeX: дроби `\dfrac`,
  единицы `\text`, десятичная `{,}`, без стрелок `→` и слэшей-делений. Физика выверена.
- Стрелки убраны и из `Task.solution_detailed` (1 задача).

### Схемы (прод-БД, 34 правки)
- Из `schema_data`/`SchemaTemplate.data` убраны подписи: названия тел (Земля, Муха, Станция…),
  событийные метки (Встреча, Вход, Вершина…), формульные подписи (S₂=v₂·t, t=L/v=?…).
  Оставлены только обозначения величин/отрезков и значения из «Дано», точки, векторы.
  Геометрия фигур сохранена; ни одна схема не опустела. 0 оставшихся подписей-тел.

### Фронтенд
- `App.jsx`: `MathText`/`ReferenceAnswerView` — эталон и ответы рендерятся построчно
  (строка с `\` → математика MathLive, проза → текстом). Подключено в «Сверьте с эталоном»,
  «Твоё решение», финальный ответ. Теперь у эталона тот же шрифт и дроби, что у ввода.
- `FormulaField.jsx`: упрощённая матклавиатура (`mathVirtualKeyboard.layouts=["numeric"]` — без вкладок sin/∫/αβγ/∞≠∈).
- `index.css`: тема клавиатуры под приложение (индиго-акцент, светлый фон) + стили рендера формул.

### Известное расхождение (НЕ менял)
- Задача 10 «Велосипедист»: `Task.correct_answer = 2.82 м/с`, но решение (и шаги 9/10) дают `≈ 2.76 м/с`
  (физически верно 2.76). Это поле числовой сверки основного решения, не пооперационки. Стоит поправить отдельно.

---

## 2026-05-26 — Сессия 3: CSRF fix, placeholder fix, MathLive в пооперационном контроле

### Задеплоено на сервер ✅ (домен www.phyzics-eor.ru, IP 5.129.199.23)

**1. CSRF в проде**
- Причина: `CSRF_COOKIE_HTTPONLY = True` запрещал JS читать `csrftoken` → пустой `X-CSRFToken` → 403.
- Фикс: `settings.py` → `CSRF_COOKIE_HTTPONLY = False` (сессионная кука осталась HttpOnly).

**2. Сырые escape-последовательности в модалке «Собери метод решения» (2 ошибки)**
- Причина: задеплоенный бандл содержал `\uXXXX` в JSX-тексте (Bug #4) — рендерилось дословно.
- Фикс: `App.jsx:3073` placeholder дроп-зоны → `{"вставь слово"}` (строка в `{}`), пересборка + rsync.

**3. MathLive (Photomath-style ввод формул) в `step_by_step`**
- Новый `ui/src/components/FormulaField.jsx`: `FormulaField` (редактируемое `<math-field>`, вывод LaTeX,
  вставка по курсору через ref, экранная матклавиатура на тач) + `FormulaDisplay` (read-only `convertLatexToMarkup`).
  Лениво грузится отдельным чанком (~226 КБ gzip), graceful-фолбэк на textarea.
- `App.jsx`: шаги `solution` (Формула/СИ/Расчёт) и `text` → `FormulaField`; палитра вставляет LaTeX-шаблоны
  (дробь/степень/корень) по курсору; ответ solution хранится JSON с LaTeX. Блоки «Твоё решение»,
  «Сверьте с эталоном», финальный ответ рендерят формулы через `StudentAnswerView`/`FormulaDisplay`.
- Бэкенд НЕ менялся: проверка шага — самооценка (`needs_choice`), машинного сравнения формул нет.
- Шрифты MathLive скопированы в `ui/public/mathlive-fonts/` → отдаются с `/static/app/` (прод-CSP `font-src 'self'`, без CDN).
- Проверено в браузере (desktop + mobile 375px) изолированным харнессом; реальный поток step_by_step на живой задаче не прогонялся.

### Не сделано / на будущее
- Системы тостов в проекте НЕТ (`useToast`/`Toast.jsx` отсутствуют, вопреки записи в CLAUDE.md). `alert()` в ~22 местах App.jsx.

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
