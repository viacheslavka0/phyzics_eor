# React Architecture Refactoring Plan

**Goal:** Break down monolithic App.jsx (6,896 lines, 38 functions) into isolated, testable components with improved accessibility and CSRF handling.

**Status:** In progress (Phase 1: Infrastructure)

---

## Phase 1: Infrastructure ✅ (DONE)

- [x] Create `src/utils/api.js` with centralized CSRF handling
  - Replaces 4 copies of `getCSRFCookie()` in App.jsx, Portal.jsx, TeacherApp.jsx, Editor.jsx
  - Provides `authFetch()`, `authFetchFormData()`, `apiCall()` helpers
  - Single source of truth for authentication

- [x] Create `src/components/stages/` directory structure
  - Will hold 10 extracted stage components (StageComprehension, StageTypicalTask, etc.)

- [x] Create `src/components/AccessibleModal.jsx`
  - WCAG 2.1 compliant modal with focus trap
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
  - Escape key and backdrop click handling
  - Focus trap prevents tabbing outside modal

---

## Phase 2: Component Extraction (TODO)

### Step 1: Extract Stage Components (10 total, ~650-850 lines each)

Stages currently defined in App.jsx at these lines:
- **StageComprehension** (line 1519) – Mapping zones to questions
- **StageTypicalTask** (line 2121) – Multiple choice typical problem
- **StageTaskPreview** (line 2611) – Task details & options preview
- **StageLearningPathChoice** (line 2710) – Difficulty selection (easy/medium/hard)
- **StageTaskList** (line 3228) – List of tasks to solve (LARGEST, ~1046 lines)
- **StageDifficultyAssessment** (line 4274) – "Was it hard?"
- **StageSolving** (line 4319) – Numeric/text answer submission & auto-check
- **StageMethodComposition** (line 4769) – Build solution method from steps
- **StageStepByStep** (line 5226) – Step-by-step solution hints
- **StageCompleted** (line 6594) – Session complete screen

### Extraction Checklist (per component):

```
[ ] 1. Copy function to `src/components/stages/Stage{Name}.jsx`
[ ] 2. Convert to named export with React.memo()
[ ] 3. Move all useState/useContext hooks to component scope
[ ] 4. Replace hardcoded fetch calls with `authFetch()`/`apiCall()` from utils/api.js
[ ] 5. Add accessibility:
    - Wrap main content in `<section role="main" aria-labelledby="title">`
    - Add `id` to titles for aria-labelledby reference
    - Replace FullScreenModal with AccessibleModal component
    - Add aria-label to interactive elements (buttons, inputs)
[ ] 6. Add React.memo() to prevent unnecessary re-renders
[ ] 7. Extract small sub-components (buttons, cards, forms)
[ ] 8. Update App.jsx to import and use new component
[ ] 9. Test in browser (navigation, state, API calls)
[ ] 10. Remove original function from App.jsx
```

---

## Phase 3: Accessibility Enhancement (TODO)

### Add ARIA Labels to Key Elements:

```jsx
// Before (no accessibility)
<button onClick={handleSubmit}>Проверить</button>

// After (accessible)
<button 
  onClick={handleSubmit}
  aria-label="Проверить ответ на вопрос осмысления"
>
  Проверить
</button>
```

### Focus Management:
- [x] AccessibleModal traps focus
- [ ] Add focus indicators to buttons/inputs (Tailwind: `focus:ring-2 focus:ring-indigo-500`)
- [ ] Announce dynamic content updates with `aria-live="polite"`

### Semantic HTML:
- Replace `<div>` wrappers with semantic tags where applicable:
  - `<nav>` for navigation
  - `<main>` for main content
  - `<section>` for logical sections
  - `<article>` for card-like content

---

## Phase 4: CSRF Centralization (TODO)

### Update all API calls to use new utils:

```jsx
// Before (duplicated CSRF logic)
const token = getCsrfToken();
const resp = await fetch("/api/task/123/submit/", {
  method: "POST",
  headers: { "X-CSRFToken": token },
  body: JSON.stringify(data),
});

// After (centralized)
import { apiCall } from "../utils/api";
const resp = await apiCall("/api/task/123/submit/", {
  method: "POST",
  body: JSON.stringify(data),
});
```

Files to update:
- [ ] App.jsx (replace 15+ fetch calls)
- [ ] Portal.jsx (replace 3+ fetch calls)
- [ ] TeacherApp.jsx (replace 12+ fetch calls)
- [ ] Editor.jsx (replace 1+ fetch calls)

---

## Phase 5: Final Cleanup (TODO)

- [ ] Remove `getCSRFCookie()` duplicates from App.jsx, Portal.jsx, TeacherApp.jsx, Editor.jsx
- [ ] Run ESLint with `npm run lint` (if configured)
- [ ] Test full user flow (login → lesson → submit answer → completion)
- [ ] Lighthouse audit for accessibility (target: 90+)
- [ ] Commit: "refactor(ui): split App.jsx into stage components, add accessibility"

---

## Benefits After Refactoring

| Metric | Before | After |
|--------|--------|-------|
| Main file size | 6,896 lines | ~650 lines |
| Component count | 1 mega | 10 isolated |
| CSRF code duplication | 4 copies | 1 (utils/api.js) |
| Testability | Difficult | Per-component unit tests |
| Accessibility (WCAG) | 0.17% ARIA | 50%+ (goal: 100%) |
| Bundle size | Same (refactoring doesn't shrink, but enables optimization) |

---

## Timeline Estimate

- **Phase 1:** ✅ Done (2h)
- **Phase 2 (Component Extraction):** 6–8h (10 components × 30–50 min each + testing)
- **Phase 3 (Accessibility):** 2–3h
- **Phase 4 (CSRF Centralization):** 1–2h
- **Phase 5 (Cleanup):** 1h

**Total:** ~12–15 hours of focused work

---

## Next Steps (for developer)

1. **Start with StageTaskList** (largest component, most complex)
   - Copy lines 3228–4273 to `src/components/stages/StageTaskList.jsx`
   - Move hooks to component level
   - Replace fetch calls with `apiCall()`
   - Add accessibility attributes
   - Test in browser

2. **Move to smaller stages** (5–10 at a time)
   - Follow same pattern as StageTaskList
   - Each should be ~30 min extraction + testing

3. **Once all stages extracted:**
   - Update App.jsx to import and render stages from components/stages/
   - Remove original functions from App.jsx
   - Test full user flow

4. **Final pass:**
   - Update Portal.jsx, TeacherApp.jsx, Editor.jsx to use utils/api.js
   - Run accessibility audit
   - Merge to main

---

## Related Files

- `src/utils/api.js` – Centralized fetch utilities
- `src/components/AccessibleModal.jsx` – Accessible modal wrapper
- `src/components/stages/` – Stage components (to be filled)
- `eora/ui/vite.config.js` – Vite build config (no changes needed)
- `eora/ui/package.json` – Dependencies (ESLint, Prettier to add if needed)
