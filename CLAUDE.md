# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**EORA** is an adaptive learning platform for teaching physics to 7–9 grade students (ages 13–15). The platform implements a sophisticated multi-stage learning algorithm that adapts problem difficulty based on student performance, combining:

- **Adaptive problem selection** — difficulty escalates/de-escalates based on correct/incorrect answers
- **Knowledge systems (КС)** — structured physics concepts with cloze-style comprehension tasks
- **Method composition** — students arrange solution steps in correct order
- **Step-by-step explanations** — guided problem solving with hints
- **Teacher dashboard** — teachers create and manage schemas, set learning parameters

### Current Focus

**UX/UI Redesign (May 2026)** — Visual modernization without changing pedagogical logic. Reference: Duolingo + Khan Academy (clean, encouraging, smooth micro-animations).

**Stage 1 Complete:** Toast notification system replacing `alert()` dialogs, animation keyframes, progress bar visibility improvements.

**Stage 2 In Progress:** Sidebar redesign (dark → light), stage transition animations, error feedback animations, completion screen polish.

---

## Tech Stack

| Layer | Technology | Key Details |
|-------|-----------|-----------|
| **Frontend** | React 19 + Vite | Tailwind CSS 4 + PostCSS, Chart.js for analytics, Konva for canvas drawing |
| **Backend** | Django 5.2 + DRF 3.17 | CORS enabled for dev, session-based auth, PostgreSQL in production |
| **Architecture** | Monorepo | `/ui/` (React SPA) + `/learning/` (Django app) in same repo |
| **Deployment** | Gunicorn + static files | See `DEPLOY.md` for production setup |

**Frontend dependencies:** `react`, `react-dom`, `chart.js`, `react-chartjs-2`, `konva`, `react-konva`

**Backend dependencies:** Django, DRF, `django-cors-headers`, Pillow (image processing), psycopg2 (PostgreSQL)

---

## Project Structure

```
eora/
├── CLAUDE.md                  ← You are here
├── DEVLOG.md                  ← Session logs and recent changes
├── DEPLOY.md, README_SERVER.md ← Deployment & server setup
├── manage.py                  ← Django entry point
├── requirements.txt           ← Backend Python dependencies
│
├── ui/                        ← React SPA (Vite)
│   ├── package.json           ← npm scripts, dependencies
│   ├── vite.config.js         ← Vite configuration
│   ├── tailwind.config.js     ← Tailwind design tokens
│   ├── src/
│   │   ├── App.jsx            ← Main student interface (6600+ lines)
│   │   ├── Portal.jsx         ← Login screen
│   │   ├── TeacherApp.jsx     ← Teacher dashboard (5500+ lines)
│   │   ├── Editor.jsx         ← Staging environment
│   │   ├── index.css          ← Global styles + animations
│   │   ├── components/
│   │   │   ├── AccessibleModal.jsx
│   │   │   ├── SchemaEditor.jsx     ← DO NOT MODIFY LIGHTLY
│   │   │   ├── ElementCreatorVisual.jsx ← DO NOT MODIFY LIGHTLY
│   │   │   ├── ResearchDashboard.jsx
│   │   │   └── stages/              ← Stage components (under refactoring)
│   │   │       └── index.js
│   │   ├── utils/             ← Utility functions
│   │   └── assets/
│   └── public/
│
├── learning/                  ← Django app (core backend)
│   ├── models.py              ← Database schema (KnowledgeSystem, Task, etc.)
│   ├── views.py               ← API endpoints (145K+ lines)
│   ├── serializers.py         ← DRF serializers
│   ├── services.py            ← Business logic (learning stage resolution)
│   ├── admin.py               ← Django admin setup
│   ├── urls.py                ← URL routing
│   ├── management/            ← Management commands
│   └── migrations/            ← Database migrations
│
├── eora/                      ← Django project config
│   ├── settings.py
│   ├── urls.py                ← Main URL routing (mounts /learning/)
│   └── wsgi.py
│
├── analytics/                 ← Analytics & reporting
├── deploy/                    ← Deployment scripts & configs
└── media/                     ← User uploads (photos, etc.)
```

---

## Critical Architecture Constraints

### ⚠️ DO NOT MODIFY (High Risk)

1. **`learning/services.py`** — Contains `resolveLearningStage()` function, the core adaptive learning algorithm that determines which stage a student should be on. Any change breaks the entire learning flow.

2. **`App.jsx` — `ErrorBranchingBlock` component** (around line 2960) — Handles incorrect answer logic and branching. Changing how errors are rendered or how branches are triggered affects student experience unpredictably.

3. **`App.jsx` — `STAGES` constant** (lines 47–60) — Hardcoded stage definitions. Adding/removing stages requires coordinating with backend, database, and teaching algorithm.

4. **API calls in views.py/serializers.py** — Do not change request/response shapes without updating frontend. Currently tightly coupled.

5. **`AppContext` in `App.jsx`** — Existing context fields are used throughout. Adding fields is OK, but don't rename/remove: `user`, `ks` (knowledge system), `session`, `task`, `error`, `errorBranch`, `stage`.

6. **`NumericAnswerInput` wheel scroll handler** (App.jsx ~line 1350) — Students rely on mouse wheel for number input. Disabling or changing behavior breaks mobile/tablet input.

7. **`TeacherApp.jsx`** — Teacher interface for schema/task creation. Off-limits unless explicitly asked to maintain it.

8. **`SchemaEditor.jsx` & `ElementCreatorVisual.jsx`** — Complex visualization components for schema editing. Fragile, rarely modified.

---

### ✅ SAFE TO MODIFY

- **`index.css`** — Global styles, animations, utility classes. Front-end redesign work happens here.
- **`tailwind.config.js`** — Tailwind tokens, animation keyframes.
- **Components in `components/stages/`** — These are under refactoring; encourage extracting stage logic from App.jsx into isolated components.
- **`Portal.jsx`** — Login screen, safe to redesign.
- **UI text, labels, placeholders** — Changing user-facing text is safe.
- **Styling of existing components** — Colors, spacing, typography (use Tailwind utilities).

---

## Development Workflow

### 1. Start the Server (Backend)

```bash
cd /Users/vslav/Yandex.Disk.localized/Компьютер\ DESKTOP-5E97UAD/physics/eora

# Option A: Quick start (Windows)
.\START_SERVER.bat

# Option B: Manual (all platforms)
python manage.py runserver
# Server runs at http://127.0.0.1:8000/
```

**Check server health:**
```bash
python manage.py check
```

**Apply database migrations** (if needed):
```bash
python manage.py migrate
```

**Create a test user** (for development):
```bash
python manage.py createsuperuser
# Use admin credentials to log in at http://127.0.0.1:8000/app/
```

### 2. Start the Frontend (in separate terminal)

```bash
cd ui
npm install           # First time only
npm run dev           # Starts Vite dev server on http://127.0.0.1:5173/
```

**Vite HMR** — Changes to `.jsx` and `.css` files auto-reload instantly.

### 3. Open the Application

- **Student interface:** http://127.0.0.1:5173/ (login with test user)
- **Teacher dashboard:** http://127.0.0.1:5173/teacher/ (admin only)
- **Editor (staging):** http://127.0.0.1:5173/editor

### Common Commands

```bash
# Frontend
npm run build         # Production build
npm run lint          # Check for linting errors
npm run preview       # Preview production build locally

# Backend
python manage.py createsuperuser  # Add user
python manage.py runserver 8001   # Different port if 8000 in use
python manage.py check            # Validate configuration
python manage.py migrate          # Apply pending migrations
```

---

## High-Level Architecture

### Frontend Data Flow

```
Portal.jsx (Login)
    ↓
App.jsx (Main Interface)
    ├── AppContext (user, session, ks, task, stage, error)
    ├── Sidebar (navigation, progress)
    ├── Stage Components (StageComprehension, StageTaskList, etc.)
    │   └── Render based on current `stage` value
    └── API calls to /api/ks/, /api/tasks/, /api/sessions/
```

**Key hooks:**
- `useApp()` — Access AppContext
- `useToast()` — Show notifications (replacing `alert()`)

### Backend Request/Response Flow

```
Student action (e.g., submit answer)
    ↓
App.jsx → fetch() to /api/ks/{id}/check/ (or similar)
    ↓
views.py → @action handler → business logic → serializer
    ↓
services.py → resolveLearningStage() → determine next stage
    ↓
Response: { session: {...}, ks: {...}, stage: "next_stage", ... }
    ↓
App.jsx updates AppContext → UI re-renders
```

### The 10-Stage Learning Journey

Each task progresses through these stages (defined in `STAGES` constant):

1. **comprehension** — Cloze task: fill blanks to understand the concept
2. **typical_task** — Worked example: understand how to apply the concept
3. **task_preview** — Peek at the problem before starting
4. **learning_path_choice** — Student picks order: easy → hard or hard → easy
5. **task_list** — Browse available problems (could skip some)
6. **difficulty_assessment** — Solve one problem, system assesses if ready for harder ones
7. **solving_easy/medium/hard** — Solve actual problems (difficulty adapts)
8. **method_composition** — Arrange solution steps in correct order
9. **step_by_step** — Guided problem solving with hints
10. **completed** — Celebration screen, move to next task

**Adaptive Logic:** After each answer:
- ✓ Correct → increase difficulty or move forward
- ✗ Incorrect → decrease difficulty or offer hints

This logic is in `services.py` and **must not be changed** without careful testing.

---

## Current UX Redesign Plan

### Session 1 (Animation System & Toast Notifications)

**Status:** ✅ Complete

**Changes Made:**
1. **`Toast.jsx`** — New component replaces 25+ `alert()` calls
   - `useToast()` hook: `toast.error()`, `toast.success()`, `toast.warning()`, `toast.info()`
   - Auto-dismiss with configurable durations
   - Animated entrance/exit (toastIn, toastOut)

2. **`index.css`** — Added animation keyframes:
   - `@keyframes shake` — Incorrect answer feedback
   - `@keyframes bounceIn` — Celebration elements
   - `@keyframes slideUp` — Stage transitions
   - `@keyframes stageEnter` — Smooth stage appearance
   - Progress bar improved (0.55rem → 0.85rem height, spring easing)

3. **`tailwind.config.js`** — Registered keyframes for JIT purge

4. **`App.jsx`** — Integrated toasts into all 25 alert locations

### Session 2 (Visual Polish & Light Sidebar)

**Status:** 🔄 In Progress

**Planned Changes:**
1. **Sidebar redesign** (App.jsx ~lines 985–1168)
   - Dark (`bg-slate-900`) → Light (`bg-white/95 backdrop-blur-sm`)
   - Update text colors, borders, hover states
   - Mobile top-bar also light theme

2. **Stage transition animations**
   - Add `key={stage}` to stage wrapper → forces React remount → CSS animation triggers
   - Smooth slide-up with fade-in

3. **Error feedback animation**
   - `ErrorBranchingBlock` adds `animate-shake` class
   - Vibrant error card with border and glow

4. **Completion screen enhancements**
   - Trophy with bounceIn animation + glow effect
   - Stats table with staggered appearance
   - Celebratory text with staggered delays

5. **Header redesign**
   - `eora-screen-header` → Card style (gradient bg, rounded border)
   - Removed left-border accent, added background color

6. **`Portal.jsx` login redesign**
   - Two-column layout (desktop): branding (left) + form (right)
   - Responsive: full-width on mobile
   - Atom icon in left panel
   - Input/button styling via utilities

---

## Key Files to Understand Before Editing

| File | Lines | Purpose | Safe to Modify? |
|------|-------|---------|---|
| `App.jsx` | 6600+ | Main student interface, 10 stage handlers, API logic | Partial (styling/text, not logic) |
| `views.py` | 145K+ | All API endpoints, session management | No (logic is critical) |
| `services.py` | ~500 | Stage resolution algorithm | ❌ No |
| `models.py` | 2K+ | Database schema | No (breaking change) |
| `index.css` | 500+ | Global styles, animations | ✅ Yes (main redesign work) |
| `tailwind.config.js` | 100+ | Design tokens | ✅ Yes |
| `Portal.jsx` | 200+ | Login screen | ✅ Yes |
| `TeacherApp.jsx` | 5500+ | Teacher interface | No (rarely modified) |
| `SchemaEditor.jsx` | 2000+ | Schema editing UI | No (complex, fragile) |

---

## Common Pitfalls & How to Avoid Them

1. **Changing `STAGES` constant** → Breaks backend routing
   - **Solution:** Only add styling/text, never rename or remove stages

2. **Modifying API response shape in views.py** → Frontend breaks
   - **Solution:** Ask what data frontend needs, add new fields without removing old ones

3. **Editing `resolveLearningStage()` logic** → Adaptive algorithm breaks
   - **Solution:** If fixing a bug, test thoroughly with multiple student profiles

4. **Calling `alert()` in new code** → UI feels outdated
   - **Solution:** Always use `useToast()` instead

5. **Forgetting `key={stage}` on stage wrapper** → Stage animations don't trigger
   - **Solution:** Remounting component forces CSS animation to replay

6. **Changing `AppContext` field names** → Widespread breakage
   - **Solution:** Add new fields, deprecate old ones gradually with console warnings

---

## Testing & Debugging

### Frontend Debugging

- **React DevTools** — Inspect component tree, props, hooks
- **Network tab** — Watch API calls, response payloads
- **Console** — Check for JS errors
- **Lighthouse** — Performance audit (Vite should keep it fast)

### Backend Debugging

```bash
# Enable SQL query logging
# In Django shell:
from django.db import connection
from django.test.utils import CaptureQueriesContext

# Or add to settings.py temporarily:
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

### Testing a Stage

1. **Start both servers** (Django + Vite)
2. **Log in as test user**
3. **Navigate to a task** that's in the stage you want to test
4. **Open DevTools** → Network tab
5. **Perform the action** (submit answer, click next, etc.)
6. **Inspect API response** to see what data comes back
7. **Check AppContext** to see if state updated correctly

---

## Environment & Dependencies

### Python (Backend)

```bash
# Check Python version (3.10+ required for Django 5.2)
python --version

# Install dependencies
pip install -r requirements.txt

# For development (add optional packages)
pip install ipython  # Better shell
pip install django-debug-toolbar  # Debug toolbar
```

### Node.js (Frontend)

```bash
# Check Node version (18+ recommended for React 19)
node --version
npm --version

# Install dependencies
cd ui && npm install

# Update packages (rarely needed)
npm update
```

---

## Git & Collaboration

**Key files to commit:**
- `ui/src/` — React components
- `learning/` — Django backend
- `eora/` — Django config
- `DEVLOG.md` — Session notes

**Files to .gitignore:**
- `db.sqlite3` — Local test database
- `.venv/`, `node_modules/` — Dependencies
- `*.pyc`, `__pycache__/` — Python cache
- `.env` — Secrets

**Before committing:**
```bash
npm run lint          # Check for style issues
python manage.py check  # Validate Django
```

---

## Useful Resources in This Repo

- **DEVLOG.md** — Session-by-session log of changes made
- **TROUBLESHOOTING.md** — Common issues & solutions
- **DEPLOY.md** — Production deployment guide
- **ui/REFACTORING_PLAN.md** — Plan to extract stage components
- **learning/services.py** — Study this to understand adaptive learning

---

## Next Steps for New Sessions

1. **Read this file** (you're doing it!)
2. **Read DEVLOG.md** — See what's been done recently
3. **Start both servers** (`python manage.py runserver` + `npm run dev`)
4. **Test the current state** — Log in, try a task
5. **Identify what to change** — Reference the UX redesign plan above
6. **Code safely** — Modify only "SAFE TO MODIFY" files
7. **Test thoroughly** — Check multiple stages, error cases, mobile view
8. **Update DEVLOG.md** — Log your changes for the next session

---

## Questions to Ask Before Starting Work

- **Is this a styling change or logic change?** (Styling = safe, logic = risky)
- **Will this affect the learning algorithm?** (If yes, needs careful testing)
- **Does this change the API shape?** (If yes, must update both frontend & backend)
- **Do I need to modify `App.jsx` directly?** (If yes, try to isolate changes in one function)
