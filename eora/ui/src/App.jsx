import React, { useEffect, useState, createContext, useContext, lazy, Suspense, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";

// Lazy load SchemaEditor for better performance
const SchemaEditor = lazy(() => import("./components/SchemaEditor"));
const ElementCreatorVisual = lazy(() => import("./components/ElementCreatorVisual"));

/**
 * EORA Learning Platform - Student Interface
 * Современный интерфейс для изучения систем знаний
 */

// ============================================================================
// UTILS & CONSTANTS
// ============================================================================

// Полноэкранная модалка через портал (перекрывает всё, включая sidebar)
function FullScreenModal({ children }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-fadeIn">{children}</div>
    </div>,
    document.body
  );
}

const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

const ensureCSRFCookie = async () => {
  if (getCSRFCookie()) return;
  await fetch("/api/csrf/", { credentials: "include" });
};

const parseHtmlErrorInfo = (html) => {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  return titleMatch?.[1]?.trim() || "";
};

const STAGES = {
  comprehension: { label: "Осмысление СК", icon: "📖", order: 1 },
  typical_task: { label: "Типовая задача", icon: "🎯", order: 2 },
  task_preview: { label: "Ознакомление с заданием", icon: "👀", order: 3 },
  learning_path_choice: { label: "Выбор порядка работы", icon: "🛤️", order: 4 },
  task_list: { label: "Список задач", icon: "📋", order: 5 },
  difficulty_assessment: { label: "Оценка трудности", icon: "⚖️", order: 6 },
  solving_easy: { label: "Решение задач", icon: "✏️", order: 7 },
  solving_medium: { label: "Решение задач", icon: "✏️", order: 7 },
  solving_hard: { label: "Решение задач", icon: "✏️", order: 7 },
  method_composition: { label: "Метод решения", icon: "🧩", order: 8 },
  step_by_step: { label: "По шагам", icon: "👣", order: 9 },
  completed: { label: "Завершено", icon: "🎉", order: 10 },
};

const DEFAULT_TASK_FORMULATION =
  "Найдите значение одной из величин, описывающих равномерное или неравномерное движение тел, в следующих задачах";

// Алгоритм адаптивного выбора задач не показывает сложность ученику

// ============================================================================
// CONTEXT
// ============================================================================

const STEP_BY_STEP_TASK_KEY = "eora_step_by_step_task_id";
const KEY_STEP_ORDERS = [6, 9];

/** Перемешивание шагов для задания на порядок (уровень «Непросто»). */
function shuffleMethodStepsForChallenge(steps) {
  const arr = [...steps];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const sorted = [...steps].sort((a, b) => (a.order || 0) - (b.order || 0));
  const matchesSorted = arr.length === sorted.length && arr.every((s, i) => s.order === sorted[i].order);
  if (matchesSorted && arr.length > 1) {
    return shuffleMethodStepsForChallenge(steps);
  }
  return arr;
}

const MAX_ANSWER_PHOTOS = 12;

/** Целевой размер трека: 0 и 1 не используем — иначе «последняя ситуация» совпадает с первой (Math.max(1,0) и т.п.). */
function effectiveTaskTrackTarget(taskProgress, session) {
  const raw = taskProgress?.target_tasks_count ?? session?.target_tasks_count;
  const n = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(n) || n < 2) return 6;
  return Math.floor(n);
}

/**
 * Поле для числового ответа: без стрелок — класс no-number-spin в CSS.
 * Колёсико: только addEventListener(..., { passive: false }) реально блокирует шаг number в Chrome.
 */
function NumericAnswerInput({ value, onChange, disabled, className, placeholder, id, "aria-label": ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);
  return (
    <input
      ref={ref}
      id={id}
      type="number"
      step="any"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
}

function tokenizeSelectableText(text) {
  return (text || "").split(/(\s+)/).map((part, index) => ({
    id: index,
    text: part,
    clean: part.replace(/[.,!?;:(){}"]/g, "").replaceAll("[", "").replaceAll("]", "").trim(),
    isSpace: /^\s+$/.test(part),
  }));
}

function buildScenario631ClozeData(ksData) {
  const methodSteps = [...(ksData?.solution_method?.steps || [])]
    .filter((step) => step?.title)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (methodSteps.length === 0) return null;

  const pickWord = (text) => {
    const words = (text || "")
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Za-zА-Яа-яЁё0-9-]/g, ""))
      .filter((w) => w.length >= 4);
    return words[0] || "";
  };

  const blanks = [];
  const lines = methodSteps.map((step, idx) => {
    const correct = pickWord(step.title);
    if (!correct) return `Шаг ${step.order}. ${step.title}`;

    const rgx = new RegExp(correct, "i");
    const maskedTitle = step.title.replace(rgx, `{{${idx}}}`);
    blanks.push({ position: idx, correct });
    return `Шаг ${step.order}. ${maskedTitle}`;
  });

  if (blanks.length === 0) return null;

  const normalizeWord = (word) =>
    String(word || "")
      .trim()
      .toLowerCase()
      .replace("ё", "е");

  const extraPool = new Set();
  methodSteps.forEach((step) => {
    const text = `${step.title || ""} ${step.description || ""}`;
    text
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Za-zА-Яа-яЁё0-9-]/g, ""))
      .filter((w) => w.length >= 4)
      .forEach((w) => extraPool.add(w));
  });
  const blankWords = blanks.map((b) => b.correct);
  const blankNorm = new Set(blankWords.map(normalizeWord));

  // Слова, которые часто являются синонимами правильных и делают задание слишком "угадываемым".
  const nearSynonymsToFilter = new Set([
    "определить",
    "вычислить",
    "измерить",
    "описывающие",
    "описывать",
    "описывать",
    "характеристики",
  ]);

  // Слова-ловушки: по форме похожи на учебные формулировки, но в типовой задаче обычно неверны.
  const distractorPool = [
    "абстрактных",
    "произвольных",
    "второстепенных",
    "несвязанных",
    "идеальных",
    "случайных",
    "несущественных",
    "разрозненных",
    "условных",
    "противоречивых",
    "гипотетических",
    "приблизительных",
  ];

  const extrasFromMethod = Array.from(extraPool).filter((w) => {
    const n = normalizeWord(w);
    if (!n) return false;
    if (blankNorm.has(n)) return false;
    if (nearSynonymsToFilter.has(n)) return false;
    return true;
  });

  const extras = Array.from(
    new Set([
      ...distractorPool.filter((w) => !blankNorm.has(normalizeWord(w))),
      ...extrasFromMethod,
    ])
  ).slice(0, 24);

  return {
    source: "fallback",
    text: lines.join("\n"),
    blanks,
    // Слова из пропусков сохраняем с повторениями (для "Выделите" x3 и т.п.),
    // затем добавляем уникальные слова-отвлекатели.
    options: [...blankWords, ...extras].slice(0, 24),
    positions: blanks.map((b) => b.position),
  };
}

const AppContext = createContext(null);

function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppContext not found");
  return ctx;
}

// ============================================================================
// MAIN APP
// ============================================================================

function ForcePasswordChange({ onSuccess }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [new2, setNew2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (newPassword.length < 8) {
      setMsg("Новый пароль — не короче 8 символов.");
      return;
    }
    if (newPassword !== new2) {
      setMsg("Повтор нового пароля не совпадает.");
      return;
    }
    setBusy(true);
    try {
      await ensureCSRFCookie();
      const res = await fetch("/api/account/change-password/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie(),
        },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось сменить пароль");
      onSuccess();
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="card p-8 max-w-md w-full animate-fadeIn">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Смените пароль</h2>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Текущий пароль</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Новый пароль</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Повтор нового пароля</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              value={new2}
              onChange={(e) => setNew2(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <button type="submit" className="btn-primary btn-lg w-full" disabled={busy}>
            {busy ? "Сохранение…" : "Сохранить новый пароль"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [selectedKS, setSelectedKS] = useState(null);
  const [ksData, setKsData] = useState(null);
  const [session, setSession] = useState(null);
  const [view, setView] = useState("catalog"); // catalog | learning
  const [accountProfile, setAccountProfile] = useState(null);

  // Load catalog
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/catalog/", { credentials: "include" });
        if (r.status === 401) {
          throw new Error(
            "Сессия недействительна или вы вышли. Обновите страницу (F5), чтобы снова открыть форму входа."
          );
        }
        if (!r.ok) {
          const text = await r.text();
          const hint = parseHtmlErrorInfo(text);
          throw new Error(
            hint || text?.slice(0, 200) || `Ошибка загрузки каталога (${r.status})`
          );
        }
        const data = await r.json();
        setCatalog(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const r = await fetch("/api/account/me/", { credentials: "include" });
        if (r.ok) setAccountProfile(await r.json());
        else setAccountProfile({ must_change_password: false, is_pilot_mode: false, student_mode: "student" });
      } catch {
        setAccountProfile({ must_change_password: false, is_pilot_mode: false, student_mode: "student" });
      }
    })();
  }, [loading]);

  // Try to восстановить последнюю выбранную систему знаний при загрузке страницы
  useEffect(() => {
    try {
      const savedKsId = window.localStorage.getItem("eora_last_ks_id");
      if (savedKsId) {
        const ksIdNum = parseInt(savedKsId, 10);
        if (!Number.isNaN(ksIdNum)) {
          setSelectedKS(ksIdNum);
          setView("learning");
        }
      }
    } catch {
      // Если localStorage недоступен, просто игнорируем
    }
  }, []);

  // Load KS data when selected
  const selectedKsRequestRef = useRef(0);
  useEffect(() => {
    if (!selectedKS) return;
    (async () => {
      const requestId = ++selectedKsRequestRef.current;
      setLoading(true);
      try {
        // Load KS details
        const ksRes = await fetch(`/api/ks/${selectedKS}/`);
        if (!ksRes.ok) throw new Error("Не удалось загрузить систему знаний");
        const ksJson = await ksRes.json();
        if (selectedKsRequestRef.current !== requestId) return;
        setKsData(ksJson);

        // Get or create session
        const sessRes = await fetch(`/api/session/current/?ks_id=${selectedKS}`);
        if (!sessRes.ok) throw new Error("Не удалось загрузить сессию");
        const sessJson = await sessRes.json();
        if (selectedKsRequestRef.current !== requestId) return;
        setSession(sessJson);
        
        // Если есть завершенная сессия и текущая сессия только что создана,
        // показываем модальное окно с предыдущими результатами
        if (sessJson.last_completed && sessJson.created && sessJson.current_stage === "comprehension") {
          // Показываем информацию о предыдущих результатах
          // Это будет обработано в компоненте LearningView
        }
        
        setView("learning");
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedKS]);

  // Сохраняем выбранную СК в localStorage, чтобы при обновлении страницы вернуться к ней
  useEffect(() => {
    try {
      if (selectedKS) {
        window.localStorage.setItem("eora_last_ks_id", String(selectedKS));
      } else {
        window.localStorage.removeItem("eora_last_ks_id");
      }
    } catch {
      // Ничего не делаем, если localStorage недоступен
    }
  }, [selectedKS]);

  // Back to catalog
  const handleBackToCatalog = () => {
    setView("catalog");
    setSelectedKS(null);
    setKsData(null);
    setSession(null);
    try {
      window.localStorage.removeItem("eora_last_ks_id");
    } catch {
      // ignore
    }
  };

  // Update session
  const updateSession = async () => {
    if (!selectedKS) return;
    const res = await fetch(`/api/session/current/?ks_id=${selectedKS}`);
    if (!res.ok) throw new Error("Не удалось обновить сессию");
    const data = await res.json();
    setSession(data);
  };

  // Context value
  const contextValue = {
    catalog,
    selectedKS,
    setSelectedKS,
    ksData,
    session,
    setSession,
    updateSession,
    handleBackToCatalog,
    accountProfile,
  };

  // Loading state
  if (loading && !catalog.length) {
    return <LoadingScreen />;
  }

  // Error state
  if (error) {
    return <ErrorScreen message={error} />;
  }

  if (accountProfile?.must_change_password) {
    return (
      <AppContext.Provider value={contextValue}>
        <ForcePasswordChange
          onSuccess={() => setAccountProfile({ ...accountProfile, must_change_password: false })}
        />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-slate-50">
        {view === "catalog" && <CatalogView />}
        {view === "learning" && ksData && <LearningView />}
      </div>
    </AppContext.Provider>
  );
}

// ============================================================================
// SCREENS
// ============================================================================

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Загрузка...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-md text-center animate-fadeIn">
        <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">Что-то пошло не так</h2>
        <p className="text-slate-600 mb-6 leading-relaxed">{message}</p>
        <button type="button" className="btn-primary btn-lg" onClick={() => window.location.reload()}>
          Обновить страницу
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// CATALOG VIEW
// ============================================================================

function CatalogView() {
  const { catalog, setSelectedKS } = useApp();
  const [expandedClass, setExpandedClass] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);

  // Подсчёт общего числа СК
  const totalKS = catalog.reduce((acc, sc) =>
    acc + (sc.sections || []).reduce((a2, sec) =>
      a2 + (sec.topics || []).reduce((a3, t) => a3 + (t.knowledge_systems?.length || 0), 0), 0), 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-emerald-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <span className="text-white font-bold text-lg">⚛</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Физика</h1>
            <p className="text-xs text-slate-400 leading-tight">Электронный образовательный ресурс</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500" />
        <div className="absolute inset-0 opacity-[0.07]" style={{backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"}} />
        <div className="relative max-w-5xl mx-auto px-6 py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            Привет! Готов изучать физику?
          </h2>
          <p className="text-indigo-100 sm:text-lg max-w-lg mx-auto">
            Выбери тему — и начни путь от теории к уверенному решению задач
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <div className="bg-white/20 backdrop-blur rounded-xl px-5 py-2.5 text-white text-sm font-semibold">
              📖 {totalKS} {totalKS === 1 ? "тема" : totalKS < 5 ? "темы" : "тем"} доступно
            </div>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-3">
          {catalog.map((schoolClass) => {
            const isClassOpen = expandedClass === schoolClass.id;
            return (
              <div key={schoolClass.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden transition-shadow hover:shadow-md">
                {/* Class header */}
                <button
                  onClick={() => setExpandedClass(isClassOpen ? null : schoolClass.id)}
                  className="w-full px-5 py-4 flex items-center justify-between transition-colors hover:bg-blue-50/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-sm text-white font-extrabold text-xl">
                      {schoolClass.number}
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-base text-slate-900">{schoolClass.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {schoolClass.sections?.length || 0} {(() => { const n = schoolClass.sections?.length || 0; return n === 1 ? "раздел" : n < 5 ? "раздела" : "разделов"; })()}
                      </p>
                    </div>
                  </div>
                  <ChevronIcon expanded={isClassOpen} />
                </button>

                {/* Sections */}
                {isClassOpen && (
                  <div className="border-t border-slate-100">
                    {schoolClass.sections?.map((section, si) => {
                      const isSectionOpen = expandedSection === section.id;
                      // Считаем общее число СК в разделе
                      const sectionKSCount = (section.topics || []).reduce((a, t) => a + (t.knowledge_systems?.length || 0), 0);
                      return (
                        <div key={section.id} className={si > 0 ? "border-t border-slate-50" : ""}>
                          <button
                            onClick={() => setExpandedSection(isSectionOpen ? null : section.id)}
                            className="w-full px-5 py-3 pl-12 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600 text-sm font-bold">
                                {si + 1}
                              </div>
                              <span className="font-medium text-sm text-slate-800">{section.title}</span>
                              {sectionKSCount > 0 && (
                                <span className="text-[10px] bg-blue-100 text-blue-600 font-semibold rounded-full px-2 py-0.5">
                                  {sectionKSCount}
                                </span>
                              )}
                            </div>
                            <ChevronIcon expanded={isSectionOpen} size="sm" />
                          </button>

                          {/* Topics + KS */}
                          {isSectionOpen && (
                            <div className="pb-2">
                              {section.topics?.map((topic) => (
                                <div key={topic.id} className="px-5 pl-20 py-2">
                                  {section.topics.length > 1 && (
                                    <div className="text-xs font-medium text-slate-500 mb-2">{topic.title}</div>
                                  )}
                                  <div className="flex flex-wrap gap-2">
                                    {topic.knowledge_systems?.map((ks) => {
                                      const prog = ks.user_progress;
                                      return (
                                        <button
                                          key={ks.id}
                                          onClick={() => setSelectedKS(ks.id)}
                                          className={`group flex items-center gap-2.5 px-4 py-3 rounded-xl border-1.5 transition-all text-sm font-semibold ${
                                            prog?.completed
                                              ? "border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 hover:border-emerald-400 text-emerald-800"
                                              : "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 hover:border-indigo-300 hover:shadow-sm text-indigo-700"
                                          }`}
                                        >
                                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                                            prog?.completed
                                              ? "bg-emerald-200/60 group-hover:bg-emerald-300/60 text-emerald-700"
                                              : "bg-indigo-200/60 group-hover:bg-indigo-300/60"
                                          }`}>
                                            {prog?.completed ? "✓" : "⚡"}
                                          </span>
                                          <span className="flex-1 text-left">{ks.title}</span>
                                          {prog?.completed && (
                                            <span className="text-xs font-normal text-emerald-600 whitespace-nowrap">
                                              {Math.round(prog.score_percent)}% | {prog.tasks_correct}/{prog.tasks_solved}
                                            </span>
                                          )}
                                          <span className={`group-hover:translate-x-0.5 transition-transform ml-1 ${prog?.completed ? "text-emerald-500" : "text-indigo-400"}`}>→</span>
                                        </button>
                                      );
                                    })}
                                    {!topic.knowledge_systems?.length && (
                                      <span className="text-xs text-slate-400 italic">Темы пока не добавлены</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {catalog.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📭</div>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">Каталог пуст</h3>
              <p className="text-sm text-slate-500">Учитель ещё не добавил систем знаний</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 text-center">
        <p className="text-xs text-slate-400">Электронный образовательный ресурс по физике • 2026</p>
      </footer>
    </div>
  );
}

// ============================================================================
// LEARNING VIEW
// ============================================================================

/** API при завершённой сессии отдаёт id: null и current_stage: null — без этого UI ошибочно подставлял «comprehension». */
function resolveLearningStage(session) {
  if (!session) return "comprehension";
  if (session.has_completed && !session.id) return "completed";
  return session.current_stage || "comprehension";
}

function LearningView() {
  const { ksData, session, handleBackToCatalog, accountProfile } = useApp();
  const [resetting, setResetting] = useState(false);
  const isPilotMode = !!accountProfile?.is_pilot_mode;
  const stage = resolveLearningStage(session);
  const [showTeacherReviewNotice, setShowTeacherReviewNotice] = useState(false);
  const latestFinalReview = session?.final_review || null;
  const showTaskProgress = [
    "task_list",
    "solving_easy",
    "solving_medium",
    "solving_hard",
    "step_by_step",
  ].includes(stage);

  useEffect(() => {
    if (!session?.id || !latestFinalReview?.attempt_id) {
      setShowTeacherReviewNotice(false);
      return;
    }
    if (latestFinalReview.status === "pending") {
      setShowTeacherReviewNotice(false);
      return;
    }
    const seenKey = `eora_final_review_seen_${session.id}_${latestFinalReview.attempt_id}`;
    const seen = window.localStorage.getItem(seenKey);
    setShowTeacherReviewNotice(!seen);
  }, [session?.id, latestFinalReview?.attempt_id, latestFinalReview?.status]);

  const closeTeacherReviewNotice = () => {
    if (session?.id && latestFinalReview?.attempt_id) {
      const seenKey = `eora_final_review_seen_${session.id}_${latestFinalReview.attempt_id}`;
      window.localStorage.setItem(seenKey, "1");
    }
    setShowTeacherReviewNotice(false);
  };

  // Poll session every 35s when final task is awaiting teacher review
  const { updateSession } = useApp();
  useEffect(() => {
    if (latestFinalReview?.status !== "pending") return;
    const id = setInterval(async () => {
      try { await updateSession(); } catch { /* ignore */ }
    }, 35000);
    return () => clearInterval(id);
  }, [latestFinalReview?.status, updateSession]);

  const handleResetProgress = async () => {
    if (!session?.id) return;
    if (!confirm("Сбросить весь прогресс? Вы начнёте с осмысления заново.")) return;
    
    setResetting(true);
    try {
      const res = await fetch(`/api/session/${session.id}/reset/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie(),
        },
      });
      if (res.ok) {
        window.localStorage.removeItem(STEP_BY_STEP_TASK_KEY);
        window.location.reload();
      } else {
        alert("Ошибка сброса: " + res.status);
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка: " + e.message);
    } finally {
      setResetting(false);
    }
  };
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await ensureCSRFCookie();
      await fetch("/api/auth/logout/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie(),
        },
      });
    } catch {
      // ignore
    }
    window.location.href = "/app/";
  };

  const solved = session?.tasks_solved_count || 0;
  const target = effectiveTaskTrackTarget(null, session);
  const progressPct = Math.min(100, Math.round((solved / target) * 100));

  return (
    <div className="min-h-screen flex">
      {/* Mobile top bar */}
      <div className="sidebar-mobile-toggle fixed top-0 left-0 right-0 z-[200] bg-slate-900 text-white flex items-center gap-3 px-4 py-3">
        <button onClick={() => setSidebarOpen(true)} className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-lg" aria-label="Меню">☰</button>
        <span className="font-semibold text-sm truncate flex-1">{ksData.title}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-medium"
        >
          Выйти
        </button>
      </div>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[300] bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {showTeacherReviewNotice && latestFinalReview && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 animate-pop">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  latestFinalReview.status === "accepted"
                    ? "bg-emerald-100"
                    : "bg-amber-100"
                }`}
              >
                {latestFinalReview.status === "accepted" ? "✅" : "🛠️"}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  {latestFinalReview.status === "accepted"
                    ? "Учитель проверил итоговую задачу"
                    : "Итоговая задача отправлена на доработку"}
                </h3>
                {latestFinalReview.teacher_grade_2_5 != null && (
                  <p className="text-sm text-slate-700 mt-2">
                    Оценка учителя:{" "}
                    <span className="font-semibold">{latestFinalReview.teacher_grade_2_5}</span>
                  </p>
                )}
                {latestFinalReview.mastery_percent != null && (
                  <p className="text-sm text-slate-700">
                    Итоговое усвоение (система + учитель):{" "}
                    <span className="font-semibold">{latestFinalReview.mastery_percent}%</span>
                  </p>
                )}
                {latestFinalReview.teacher_comment && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Комментарий учителя
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-line">
                      {latestFinalReview.teacher_comment}
                    </p>
                  </div>
                )}
                {latestFinalReview.status === "rejected" && (
                  <p className="text-sm text-amber-700 mt-3">
                    Откройте последнюю ситуацию и отправьте обновленное решение. После проверки уведомление придет снова.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={closeTeacherReviewNotice}
                className="btn-primary w-full"
              >
                {latestFinalReview.status === "accepted" ? "Понятно" : "Перейти к доработке"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-desktop bg-slate-900 text-white flex flex-col fixed h-screen z-[310] transition-all duration-300 group ${
          sidebarCollapsed ? "w-16 hover:w-72" : "w-72"
        } ${sidebarOpen ? "translate-x-0" : ""}`}
      >
        {/* Close on mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="sidebar-mobile-toggle absolute top-3 right-3 w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white text-sm"
          aria-label="Закрыть"
        >✕</button>

        {/* Collapse toggle */}
        <div className={`p-3 border-b border-slate-700 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
          {!sidebarCollapsed && (
            <button onClick={handleBackToCatalog} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">ЭОР</div>
                <div className="text-xs text-slate-400">← К каталогу</div>
              </div>
            </button>
          )}
          {sidebarCollapsed && (
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 group-hover:hidden">
              <span className="text-white font-bold text-lg">E</span>
            </div>
          )}
          {sidebarCollapsed && (
            <button onClick={handleBackToCatalog} className="hidden group-hover:flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">ЭОР</div>
                <div className="text-xs text-slate-400">← К каталогу</div>
              </div>
            </button>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-sm ${sidebarCollapsed ? "hidden group-hover:flex" : ""}`}
            title={sidebarCollapsed ? "Закрепить панель" : "Свернуть панель"}
          >
            {sidebarCollapsed ? "☰" : "◀"}
          </button>
        </div>

        {/* Collapsed mini progress */}
        {sidebarCollapsed && (
          <div className="flex flex-col items-center py-4 gap-3 group-hover:hidden">
            <div className="relative w-10 h-10">
              <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#334155" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke="#34d399" strokeWidth="3"
                  strokeDasharray={`${progressPct} ${100 - progressPct}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-400">{solved}/{target}</span>
            </div>
            <div className="text-emerald-400 text-lg font-bold">{session?.tasks_correct_count || 0}</div>
            <div className="text-slate-500 text-[9px] uppercase tracking-wider">верно</div>
          </div>
        )}

        {/* Full sidebar content (visible when expanded or on hover) */}
        <div className={`flex flex-col flex-1 overflow-hidden ${sidebarCollapsed ? "hidden group-hover:flex" : "flex"}`}>
          <div className="p-5 border-b border-slate-700">
            <div className="text-xs text-slate-300 uppercase tracking-wider mb-2">Система знаний</div>
            <div className="font-semibold text-base leading-tight text-white">{ksData.title}</div>
          </div>

          {showTaskProgress && (
            <div className="p-5 flex-1 overflow-auto">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-4">Прогресс</div>
              <StageProgress currentStage={stage} session={session} ksData={ksData} />
            </div>
          )}

          <div className="p-5 border-t border-slate-700 bg-slate-800/50">
            <div className="grid grid-cols-2 gap-4 text-center mb-4">
              <div>
                <div className="text-2xl font-bold text-emerald-400">{session?.tasks_correct_count || 0}</div>
                <div className="text-xs text-slate-400">Решено верно</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-300">{session?.tasks_solved_count || 0}</div>
                <div className="text-xs text-slate-400">Всего попыток</div>
              </div>
            </div>
            {isPilotMode && (
              <button
                onClick={handleResetProgress}
                disabled={resetting}
                className="w-full px-3 py-2 text-xs text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-50"
              >
                {resetting ? "Сброс..." : "Сбросить прогресс"}
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full mt-2 px-3 py-2 text-xs text-slate-200 border border-slate-500/40 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Выйти из аккаунта
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`main-with-sidebar flex-1 pt-0 md:pt-0 transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-72"}`} style={{ paddingTop: 0 }}>
        <div className="md:hidden h-14" />
        <LearningContent />
      </main>
    </div>
  );
}

function StageProgress({ currentStage, session, ksData }) {
  // Показываем прогресс только на этапах решения задач
  if (!session || !ksData) return null;
  const supportedStages = ["task_list", "solving_easy", "solving_medium", "solving_hard", "step_by_step"];
  if (!supportedStages.includes(currentStage)) return null;
  
  const solvedTasks = session.tasks_solved_count || 0;
  const correctTasks = session.tasks_correct_count || 0;
  const targetTasks = effectiveTaskTrackTarget(null, session);
  const remainingTasks = Math.max(0, targetTasks - solvedTasks);

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="text-xs text-slate-400 mb-2">Прогресс решения задач</div>
        <div className="text-2xl font-bold text-white mb-1">
          {solvedTasks} / {targetTasks}
        </div>
        <div className="text-sm text-slate-400">
          Осталось решить: {remainingTasks}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Верно решено</span>
            <span>{correctTasks}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${(correctTasks / Math.max(1, solvedTasks)) * 100}%` }}
            />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(solvedTasks / targetTasks) * 100}%` }}
            />
      </div>
          <div className="text-xs text-slate-400 mt-1 text-center">
            Общий прогресс
    </div>
        </div>
        </div>
      </div>
  );
}

// ============================================================================
// LEARNING CONTENT (Stage Router)
// ============================================================================

const BROWSER_BACK_GUARD_STAGES = new Set([
  "solving_easy",
  "solving_medium",
  "solving_hard",
  "step_by_step",
  "method_composition",
]);

function LearningContent() {
  const { session } = useApp();
  const stage = resolveLearningStage(session);
  const [browserBackNotice, setBrowserBackNotice] = useState(false);

  // На этапах решения и пооперационного контроля «Назад» в браузере не откатывает сценарий
  // (этап хранится на сервере). Перехватываем popstate и показываем пояснение.
  useEffect(() => {
    if (!BROWSER_BACK_GUARD_STAGES.has(stage)) {
      return undefined;
    }
    window.history.pushState({ eoraNavGuard: true }, "", window.location.href);
    const onPopState = () => {
      window.history.pushState({ eoraNavGuard: true }, "", window.location.href);
      setBrowserBackNotice(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [stage]);

  return (
    <div className="min-h-screen">
      {browserBackNotice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-pop border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Кнопка «Назад» в браузере</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-1">
              Здесь она не возвращает к предыдущему шагу урока: ход сценария хранится на сервере, а не в истории браузера.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              Если нажать «Назад» ещё раз, можно уйти со страницы или потерять несохранённый ввод. Пользуйтесь кнопками внутри задания и боковой панелью.
            </p>
            <button
              type="button"
              className="w-full btn-primary"
              onClick={() => setBrowserBackNotice(false)}
            >
              Понятно, продолжаю здесь
            </button>
          </div>
        </div>
      )}

      {/* Stage content */}
      <div className="p-4 sm:p-6 md:p-8 animate-fadeIn">
        {stage === "comprehension" && <StageComprehension />}
        {stage === "typical_task" && <StageTypicalTask />}
        {stage === "task_preview" && <StageTaskPreview />}
        {stage === "learning_path_choice" && <StageLearningPathChoice />}
        {stage === "task_list" && <StageTaskList />}
        {stage === "difficulty_assessment" && <StageDifficultyAssessment />}
        {(stage === "solving_easy" || stage === "solving_medium" || stage === "solving_hard") && <StageSolving />}
        {stage === "method_composition" && <StageMethodComposition />}
        {stage === "step_by_step" && <StageStepByStep />}
        {stage === "completed" && <StageCompleted />}
      </div>
    </div>
  );
}

// ============================================================================
// STAGE: COMPREHENSION (Осмысление СК)
// ============================================================================

/* ---------- Onboarding Guide для этапа осмысления ---------- */
const ONBOARDING_STEPS = [
  {
    target: "comprehension-table",
    title: "Таблица системы знаний",
    text: "Слева — таблица, в которой зашифрованы знания о теме. На ней выделены зоны — кликай по ним, чтобы выбрать ответ.",
    position: "right",
    emoji: "🗺️",
  },
  {
    target: "comprehension-questions",
    title: "Вопросы",
    text: "Справа — список вопросов. Нажми на вопрос, чтобы он стал активным, а потом выбери нужные зоны в таблице.",
    position: "left",
    emoji: "❓",
  },
  {
    target: "comprehension-submit",
    title: "Отправь ответ",
    text: "Когда ответишь на все вопросы, нажми кнопку «Отправить ответ» — система проверит и покажет результат.",
    position: "top",
    emoji: "🚀",
  },
];

const TASK_ONBOARDING_STEPS = [
  {
    target: "task-problem-card",
    title: "Условие задачи",
    text: "Сначала внимательно прочитайте условие. Здесь описана физическая ситуация, с которой нужно поработать.",
    position: "right",
    emoji: "📘",
  },
  {
    target: "task-difficulty-card",
    title: "Выбор трудности",
    text: "Выбери, насколько сейчас сложно, и продолжай решать.",
    position: "top",
    emoji: "⚖️",
  },
  {
    target: "task-answer-card",
    title: "Ответ и единицы",
    text: "Введите числовой ответ, а затем выберите единицы измерения из списка. Можно отвечать в удобных единицах — система пересчитает сама.",
    position: "left",
    emoji: "🔢",
  },
  {
    target: "task-photo-card",
    title: "Фото решения",
    text: "При желании можно приложить фото решения. Для последней ситуации в этой работе фото обязательно.",
    position: "right",
    emoji: "📷",
  },
  {
    target: "task-submit-button",
    title: "Отправка ответа",
    text: "Когда всё готово, нажми «Отправить». Обычно ответ проверяется сразу, а последнюю задачу посмотрит учитель.",
    position: "top",
    emoji: "🚀",
  },
];

function OnboardingGuide({ onClose }) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState(null);
  const current = ONBOARDING_STEPS[step];
  const total = ONBOARDING_STEPS.length;
  const cardWidth = 340;

  // Подсветка целевого элемента + расчёт позиции карточки
  useEffect(() => {
    const el = document.getElementById(current.target);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("onboarding-highlight");

    // Даём браузеру прокрутить и пересчитать layout
    const timer = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let top, left;
      if (current.position === "right") {
        // Справа от элемента, вертикально по центру элемента
        left = Math.min(rect.right + 16, vw - cardWidth - 16);
        top = Math.max(16, rect.top + rect.height / 2 - 100);
      } else if (current.position === "left") {
        // Слева от элемента
        left = Math.max(16, rect.left - cardWidth - 16);
        top = Math.max(16, rect.top + rect.height / 2 - 100);
      } else {
        // Сверху по центру экрана
        left = Math.max(16, (vw - cardWidth) / 2);
        top = Math.max(16, rect.top - 220);
      }
      // Не выходим за нижний край
      if (top + 240 > vh) top = vh - 260;
      setPos({ top, left });
    }, 350);

    return () => {
      clearTimeout(timer);
      el.classList.remove("onboarding-highlight");
    };
  }, [step, current.target, current.position]);

  const handleNext = () => {
    setPos(null);
    if (step < total - 1) setStep(step + 1);
    else onClose();
  };

  return (
    <>
      {/* Затемнение */}
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Карточка подсказки — привязана к элементу */}
      {pos && (
        <div
          className="fixed z-[110] pointer-events-auto bg-white rounded-2xl shadow-2xl p-5 animate-fadeIn border border-indigo-100"
          style={{ top: pos.top, left: pos.left, width: cardWidth }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Стрелка-указатель */}
          {current.position === "right" && (
            <div className="absolute -left-2 top-12 w-3 h-3 bg-white border-l border-b border-indigo-100 rotate-45" />
          )}
          {current.position === "left" && (
            <div className="absolute -right-2 top-12 w-3 h-3 bg-white border-r border-t border-indigo-100 rotate-45" />
          )}

          {/* Прогресс */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1.5">
              {ONBOARDING_STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-indigo-500" : i < step ? "w-4 bg-indigo-300" : "w-4 bg-slate-200"}`} />
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Пропустить
            </button>
          </div>

          {/* Контент */}
          <div className="text-center mb-4">
            <div className="text-3xl mb-2">{current.emoji}</div>
            <h4 className="text-base font-bold text-slate-900 mb-1">{current.title}</h4>
            <p className="text-sm text-slate-600 leading-relaxed">{current.text}</p>
          </div>

          {/* Шаг / Кнопка */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{step + 1} из {total}</span>
            <button
              onClick={handleNext}
              className="btn-primary px-5 py-1.5 text-sm"
            >
              {step < total - 1 ? "Далее →" : "Начать! 🎯"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function TaskOnboardingGuide({ steps, onClose }) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState(null);
  const total = steps.length;
  const current = total ? steps[Math.min(step, total - 1)] : null;
  const cardWidth = 340;

  useEffect(() => {
    setStep(0);
    setPos(null);
  }, [steps]);

  useEffect(() => {
    const cur = steps[step];
    if (!cur) return;
    const el = document.getElementById(cur.target);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("onboarding-highlight");

    const timer = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const position = cur.position || "top";
      let top;
      let left;
      if (position === "right") {
        left = Math.min(rect.right + 16, vw - cardWidth - 16);
        top = Math.max(16, rect.top + rect.height / 2 - 100);
      } else if (position === "left") {
        left = Math.max(16, rect.left - cardWidth - 16);
        top = Math.max(16, rect.top + rect.height / 2 - 100);
      } else {
        left = Math.max(16, (vw - cardWidth) / 2);
        top = Math.max(16, rect.top - 220);
      }
      if (top + 240 > vh) top = vh - 260;
      setPos({ top, left });
    }, 350);

    return () => {
      clearTimeout(timer);
      el.classList.remove("onboarding-highlight");
    };
  }, [step, steps]);

  const handleNext = () => {
    setPos(null);
    if (step < total - 1) setStep(step + 1);
    else onClose();
  };

  if (!total || !current) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      {pos && (
        <div
          className="fixed z-[110] pointer-events-auto bg-white rounded-2xl shadow-2xl p-5 animate-fadeIn border border-indigo-100"
          style={{ top: pos.top, left: pos.left, width: cardWidth }}
          onClick={(e) => e.stopPropagation()}
        >
          {current.position === "right" && (
            <div className="absolute -left-2 top-12 w-3 h-3 bg-white border-l border-b border-indigo-100 rotate-45" />
          )}
          {current.position === "left" && (
            <div className="absolute -right-2 top-12 w-3 h-3 bg-white border-r border-t border-indigo-100 rotate-45" />
          )}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-indigo-500" : i < step ? "w-4 bg-indigo-300" : "w-4 bg-slate-200"}`} />
              ))}
            </div>
            <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              Пропустить
            </button>
          </div>
          <div className="text-center mb-4">
            <div className="text-3xl mb-2">{current.emoji}</div>
            <h4 className="text-base font-bold text-slate-900 mb-1">{current.title}</h4>
            <p className="text-sm text-slate-600 leading-relaxed">{current.text}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{step + 1} из {total}</span>
            <button type="button" onClick={handleNext} className="btn-primary px-5 py-1.5 text-sm">
              {step < total - 1 ? "Далее →" : "Готово"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function StageComprehension() {
  const { ksData, session, updateSession, accountProfile } = useApp();
  const isPilotMode = !!accountProfile?.is_pilot_mode;
  
  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !window.localStorage.getItem("eora_comprehension_onboarding_done");
    } catch { return true; }
  });

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try { window.localStorage.setItem("eora_comprehension_onboarding_done", "1"); } catch { /* ignore */ }
  };

  // Состояние ответов
  const [answers, setAnswers] = useState({});
  const [clozeAnswers] = useState({});
  const [selectedZones, setSelectedZones] = useState({}); // questionId -> [zoneIds]
  const [showDescription, setShowDescription] = useState(false);
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState(null); // { passed, score_percent, mapping_feedback, cloze_feedback }
  const [hoveredZone, setHoveredZone] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null); // Для выбора зон

  const hasQuestions = ksData.questions?.length > 0;

  // Обработчик выбора зоны
  const handleZoneClick = (zoneId) => {
    if (!activeQuestion) return;
    
    const current = selectedZones[activeQuestion] || [];
    const isSelected = current.includes(zoneId);
    
    if (isSelected) {
      setSelectedZones({
        ...selectedZones,
        [activeQuestion]: current.filter(id => id !== zoneId)
      });
    } else {
      setSelectedZones({
        ...selectedZones,
        [activeQuestion]: [...current, zoneId]
      });
    }
  };

  // Обработчик ответа на вопрос
  const handleAnswer = (questionId, value) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  // Проверка ответов
  const handleCheck = async () => {
    setChecking(true);
    try {
      // Формируем данные для проверки
      const mappings = ksData.questions
        ?.filter(q => q.type === "match")
        .map(q => ({
          question_id: q.id,
          selected_zone_ids: selectedZones[q.id] || []
        })) || [];

      const clozeAnswersArray = Object.entries(clozeAnswers).map(([key, value]) => ({
        gap_id: key,
        answer: value
      }));

      const res = await fetch(`/api/ks/${ksData.id}/check/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({
          mappings,
          cloze_answers: clozeAnswersArray,
          answers // Для других типов вопросов
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Ошибка сервера: ${res.status}. ${errorText.substring(0, 200)}`);
      }

      const data = await res.json();
      setResults(data);

      if (data.passed) {
        // Автоматически переходим к следующему этапу через 2 секунды
        setTimeout(() => {
          updateSession();
        }, 2000);
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка проверки: " + e.message);
    } finally {
      setChecking(false);
    }
  };

  // Сброс для повтора
  const handleRetry = () => {
    setResults(null);
  };

  // Пропустить (для тестирования)
  const handleSkip = async () => {
    await fetch(`/api/session/${session.id}/advance_stage/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFCookie()
      },
      body: JSON.stringify({ next_stage: "typical_task" })
    });
    await updateSession();
  };

  // Проверка, является ли вопрос правильным
  const isQuestionCorrect = (qId) => {
    if (!results?.mapping_feedback) return null;
    const feedback = results.mapping_feedback.find(f => f.question_id === qId);
    return feedback?.ok;
  };

    return (
      <div className="max-w-6xl mx-auto">
      {/* Onboarding Guide */}
      {showOnboarding && hasQuestions && <OnboardingGuide onClose={dismissOnboarding} />}

      {/* Вводный текст */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">📖</span>
            </div>
          <div className="flex-1">
            <p className="text-slate-700 text-lg leading-relaxed">
              Знания о {ksData.title?.toLowerCase() || "данной теме"} представлены с помощью символов в таблице.
            </p>
            <button
              onClick={() => setShowDescription(!showDescription)}
              className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 transition-colors"
            >
              {showDescription ? "Скрыть описание таблицы ▲" : "Показать описание таблицы ▼"}
            </button>
            {showDescription && ksData.description && (
              <div className="mt-3 bg-blue-50 rounded-lg p-4 border border-blue-200 animate-fadeIn">
                <p className="text-blue-800 whitespace-pre-line">{ksData.description}</p>
          </div>
            )}
        </div>
      </div>
      </div>

      {/* Задание */}
      <div className="card p-6 mb-6 bg-amber-50 border-amber-200">
        <h3 className="font-bold text-lg text-amber-900 mb-1">📝 Задание</h3>
        <p className="text-amber-800">Найдите в таблице-системы знаний.</p>
      </div>

      {/* Результаты проверки */}
      {results && (
        <div className={`card p-6 mb-6 ${results.passed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${results.passed ? "bg-emerald-100" : "bg-red-100"}`}>
              <span className="text-3xl">{results.passed ? "✅" : "❌"}</span>
            </div>
            <div className="flex-1">
              <h3 className={`text-xl font-bold ${results.passed ? "text-emerald-800" : "text-red-800"}`}>
                {results.passed ? "Отлично! Вы успешно расшифровали таблицу" : "Попробуйте ещё раз"}
              </h3>
              <p className={results.passed ? "text-emerald-600" : "text-red-600"}>
                Правильных ответов: {results.score_percent}%
              </p>
            </div>
            {!results.passed && (
              <button onClick={handleRetry} className="btn-primary">
                Повторить
              </button>
            )}
          </div>
        </div>
      )}

      {/* Основной контент: таблица с зонами + вопросы */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Левая часть: таблица системы знаний */}
        <div id="comprehension-table" className="card p-4 lg:sticky lg:top-24">
          <h3 className="font-semibold mb-3">Таблица системы знаний</h3>
          
          {ksData.comprehension_image_url ? (
            <ZoneableImage
              src={ksData.comprehension_image_url}
              alt={ksData.title}
              zones={ksData.zones || []}
              hoveredZone={hoveredZone}
              selectedZones={activeQuestion ? (selectedZones[activeQuestion] || []) : []}
              onZoneClick={handleZoneClick}
              onZoneHover={setHoveredZone}
            />
          ) : ksData.image_url ? (
            <img
              src={ksData.image_url}
              alt={ksData.title}
              className="max-w-full rounded-lg"
            />
          ) : (
            <div className="bg-slate-100 rounded-lg p-8 text-center text-slate-500">
              Изображение не загружено
      </div>
          )}

          {activeQuestion && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              💡 Кликайте на зоны таблицы, чтобы выбрать правильные ответы
            </div>
          )}
        </div>

        {/* Правая часть: вопросы (только зоны, без cloze) */}
        <div id="comprehension-questions" className="space-y-4 lg:max-h-[600px] lg:overflow-y-auto pr-1">
          {!hasQuestions ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <span className="text-3xl mb-3 block">📝</span>
              <p className="text-amber-800 font-medium">Задания ещё не добавлены</p>
              <p className="text-amber-600 text-sm mt-1">
                Добавьте вопросы через панель учителя
              </p>
            </div>
          ) : (
            <>
              {ksData.questions?.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={idx}
                  answer={answers[q.id]}
                  selectedZones={selectedZones[q.id] || []}
                  zones={ksData.zones || []}
                  isActive={activeQuestion === q.id}
                  isCorrect={isQuestionCorrect(q.id)}
                  onAnswer={(val) => handleAnswer(q.id, val)}
                  onActivate={() => setActiveQuestion(activeQuestion === q.id ? null : q.id)}
                  disabled={results !== null}
                />
              ))}
            </>
        )}
      </div>
    </div>

      {/* Кнопки действий */}
      <div id="comprehension-submit" className="flex justify-between items-center mt-8">
        {isPilotMode ? (
          <button
            onClick={handleSkip}
            className="text-slate-500 hover:text-slate-700 text-sm"
          >
            Пропустить (для апробации) →
          </button>
        ) : <span />}

        {hasQuestions && !results?.passed && (
          <button
            onClick={handleCheck}
            disabled={checking}
            className="btn-primary btn-lg"
          >
            {checking ? "Проверка..." : "Отправить ответ"}
          </button>
        )}

        {results?.passed && (
          <button
            onClick={() => updateSession()}
            className="btn-primary btn-lg"
          >
            Продолжить →
          </button>
        )}
        </div>

      {/* Плавающая кнопка подсказок */}
      {!showOnboarding && hasQuestions && (
        <button
          onClick={() => setShowOnboarding(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-gradient-to-br from-blue-500 to-teal-500 text-white rounded-full shadow-lg shadow-blue-300/40 hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center text-xl"
          title="Показать подсказки"
        >
          💡
        </button>
      )}
        </div>
  );
}

// Компонент картинки с масштабируемыми зонами
function ZoneableImage({ src, alt, zones, hoveredZone, selectedZones, onZoneClick, onZoneHover }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Вычисляем масштаб при загрузке картинки и при ресайзе
  const updateScale = useCallback(() => {
    if (imgRef.current) {
      const displayedWidth = imgRef.current.offsetWidth;
      const naturalWidth = imgRef.current.naturalWidth;
      if (naturalWidth > 0) {
        setScale(displayedWidth / naturalWidth);
      }
    }
  }, []);

  useEffect(() => {
    if (imageLoaded) {
      updateScale();
    }
  }, [imageLoaded, updateScale]);

  useEffect(() => {
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    updateScale();
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="max-w-full rounded-lg"
        onLoad={handleImageLoad}
      />
      
      {/* Зоны поверх картинки с масштабированием */}
      {imageLoaded && zones.map((zone) => {
        const isHovered = hoveredZone === zone.id;
        const isSelected = selectedZones.includes(zone.id);
        
        return (
          <div
            key={zone.id}
            className={`absolute border-2 cursor-pointer transition-all ${
              isSelected
                ? "border-emerald-500 bg-emerald-500/30"
                : isHovered
                  ? "border-indigo-500 bg-indigo-500/20"
                  : "border-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/30"
            }`}
            style={{
              left: zone.x * scale,
              top: zone.y * scale,
              width: zone.width * scale,
              height: zone.height * scale,
            }}
            onClick={() => onZoneClick(zone.id)}
            onMouseEnter={() => onZoneHover(zone.id)}
            onMouseLeave={() => onZoneHover(null)}
          >
            {(isHovered || isSelected) && (
              <span 
                className="absolute left-0 text-xs bg-slate-800 text-white px-2 py-0.5 rounded whitespace-nowrap z-10"
                style={{ top: -24 }}
              >
                {zone.label}
              </span>
            )}
      </div>
        );
      })}
    </div>
  );
}

// Карточка вопроса
function QuestionCard({ question, index, answer, selectedZones, zones, isActive, isCorrect, onAnswer, onActivate, disabled }) {
  const typeLabels = {
    text: "Открытый ответ",
    single: "Выберите один",
    multiple: "Выберите несколько",
    match: "Найдите на таблице",
  };

  const getBorderColor = () => {
    if (isCorrect === true) return "border-emerald-400 bg-emerald-50";
    if (isCorrect === false) return "border-red-400 bg-red-50";
    if (isActive) return "border-blue-400 bg-blue-50";
    return "border-slate-200";
  };

  return (
    <div className={`card p-4 border-2 transition-colors ${getBorderColor()}`}>
      <div className="flex items-start gap-3 mb-3">
        <span className="w-7 h-7 bg-slate-800 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
          {index + 1}
        </span>
        <div className="flex-1">
          <p className="font-medium">{question.text}</p>
          <span className="text-xs text-slate-500">{typeLabels[question.type]}</span>
        </div>
        {isCorrect !== null && (
          <span className="text-2xl">{isCorrect ? "✅" : "❌"}</span>
        )}
      </div>

      {/* Тип: text */}
      {question.type === "text" && (
        <input
          type="text"
          value={answer || ""}
          onChange={(e) => onAnswer(e.target.value)}
          disabled={disabled}
          placeholder="Введите ответ..."
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
        />
      )}

      {/* Тип: single */}
      {question.type === "single" && question.options?.length > 0 && (
      <div className="space-y-2">
          {question.options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`q_${question.id}`}
                checked={answer === i}
                onChange={() => onAnswer(i)}
                disabled={disabled}
                className="w-4 h-4"
              />
              <span className={answer === i ? "font-medium" : ""}>{opt.text || opt}</span>
            </label>
          ))}
          </div>
      )}

      {/* Тип: multiple */}
      {question.type === "multiple" && question.options?.length > 0 && (
        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(answer || []).includes(i)}
                onChange={(e) => {
                  const current = answer || [];
                  if (e.target.checked) {
                    onAnswer([...current, i]);
                  } else {
                    onAnswer(current.filter(x => x !== i));
                  }
                }}
                disabled={disabled}
                className="w-4 h-4"
              />
              <span>{opt.text || opt}</span>
            </label>
        ))}
      </div>
      )}

      {/* Тип: match — выбор зон */}
      {question.type === "match" && (
        <div>
          <button
            onClick={onActivate}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            {isActive ? "🔍 Выбор зон активен" : "Нажмите, чтобы выбрать зоны"}
          </button>
          
          {selectedZones.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedZones.map(zoneId => {
                const zone = zones.find(z => z.id === zoneId);
                return (
                  <span key={zoneId} className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-sm">
                    {zone?.label || `Зона ${zoneId}`}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Карточка текста с пропусками
function ClozeCard({ cloze, answers, results, onAnswer, disabled }) {
  // Используем all_options с сервера (уже перемешаны)
  // Если нет all_options — собираем из blanks + distractors (fallback)
  const [shuffledOptions] = useState(() => {
    if (cloze.all_options && cloze.all_options.length > 0) {
      return cloze.all_options;
    }
    // Fallback для совместимости
    const allCorrect = (cloze.blanks || []).map(b => b.correct);
    const allDistractors = cloze.distractors || [];
    const allOptions = [...new Set([...allCorrect, ...allDistractors])];
    return allOptions.sort(() => Math.random() - 0.5);
  });

  // Парсим marked_text и заменяем {{0}}, {{1}} на выпадающие списки
  const renderClozeText = () => {
    if (!cloze.marked_text) return <p className="text-slate-500">Текст не задан</p>;

    const parts = [];
    let lastIndex = 0;
    const regex = /\{\{(\d+)\}\}/g;
    let match;

    while ((match = regex.exec(cloze.marked_text)) !== null) {
      // Текст до маркера
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {cloze.marked_text.substring(lastIndex, match.index)}
          </span>
        );
      }

      const position = parseInt(match[1]);
      const key = `${cloze.id}:${position}`;
      const currentAnswer = answers[key] || "";
      
      // Получаем feedback для этого пропуска
      const feedback = results?.find(f => f.gap_id === key);
      const isCorrect = feedback?.ok;

      parts.push(
        <select
          key={`select-${position}`}
          value={currentAnswer}
          onChange={(e) => onAnswer(position, e.target.value)}
          disabled={disabled}
          className={`mx-1 px-2 py-1 border rounded text-sm ${
            isCorrect === true
              ? "bg-emerald-100 border-emerald-400"
              : isCorrect === false
                ? "bg-red-100 border-red-400"
                : "border-slate-300"
          }`}
        >
          <option value="">— выберите —</option>
          {shuffledOptions.map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      );

      lastIndex = regex.lastIndex;
    }

    // Остаток текста
    if (lastIndex < cloze.marked_text.length) {
      parts.push(
        <span key={`text-end`}>
          {cloze.marked_text.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <div className="card p-4 border border-slate-200">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
          Текст с пропусками
        </span>
      </div>
      <div className="text-slate-800 leading-relaxed">
        {renderClozeText()}
      </div>
    </div>
  );
}

// ============================================================================
// STAGE: TYPICAL TASK (Формулировка типовой задачи)
// ============================================================================

function StageTypicalTask() {
  const { ksData, session, updateSession } = useApp();

  // Шаг: "choose" (выбор варианта) → "cloze" (заполни пропуски)
  const hasCloze = !!ksData.typical_task_cloze?.marked_text;
  const [step, setStep] = useState("choose"); // "choose" | "cloze"

  // === Шаг 1: выбор из вариантов ===
  const [selectedId, setSelectedId] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const options = ksData.typical_task_options || [];

  const handleSubmit = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/session/${session.id}/submit_typical_task/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ option_id: selectedId })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setSubmitted(true);
      } else {
        const error = await res.json();
        throw new Error(error.detail || "Ошибка");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryChoice = () => {
    setSelectedId(null);
    setSubmitted(false);
    setResult(null);
  };

  const handleGoToCloze = () => {
    setStep("cloze");
  };

  // === Шаг 2: cloze (заполнение пропусков) ===
  const [clozeAnswers, setClozeAnswers] = useState({});
  const [clozeResult, setClozeResult] = useState(null);
  const [clozeChecking, setClozeChecking] = useState(false);
  const [activeClozeBlank, setActiveClozeBlank] = useState(null);

  const clozeData = ksData.typical_task_cloze || {};
  const [shuffledClozeOptions] = useState(() => clozeData.all_options || []);
  const selectedClozeWords = Object.values(clozeAnswers).filter(Boolean);
  const clozeWordUsage = selectedClozeWords.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});
  const remainingClozeOptions = [];
  shuffledClozeOptions.forEach((word) => {
    if (clozeWordUsage[word]) {
      clozeWordUsage[word] -= 1;
    } else {
      remainingClozeOptions.push(word);
    }
  });
  const remainingClozeOptionCounts = remainingClozeOptions.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});
  const remainingClozeOptionWords = Object.keys(remainingClozeOptionCounts);

  const handleClozeAnswer = (position, value) => {
    setClozeAnswers({ ...clozeAnswers, [String(position)]: value });
  };
  const handlePickClozeWord = (word) => {
    if (clozeResult?.passed) return;
    const targetPos =
      activeClozeBlank ??
      (clozeData.blanks || []).find((b) => !clozeAnswers[String(b.position)])?.position;
    if (targetPos === undefined || targetPos === null) return;
    setClozeAnswers((prev) => ({ ...prev, [String(targetPos)]: word }));
    setActiveClozeBlank(null);
  };
  const handleDropClozeWord = (position, event) => {
    if (clozeResult?.passed) return;
    event.preventDefault();
    const droppedWord = event.dataTransfer.getData("text/plain");
    if (!droppedWord) return;
    setClozeAnswers((prev) => ({ ...prev, [String(position)]: droppedWord }));
    setActiveClozeBlank(null);
  };

  const handleClozeCheck = async () => {
    setClozeChecking(true);
    try {
      const res = await fetch(`/api/session/${session.id}/check_typical_task_cloze/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ answers: clozeAnswers })
      });
      if (res.ok) {
        const data = await res.json();
        setClozeResult(data);
      } else {
        throw new Error("Ошибка проверки");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка: " + e.message);
    } finally {
      setClozeChecking(false);
    }
  };

  const handleClozeRetry = () => {
    setClozeAnswers({});
    setClozeResult(null);
    setActiveClozeBlank(null);
  };

  const handleContinue = async () => {
    await fetch(`/api/session/${session.id}/advance_stage/`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFCookie()
      },
      body: JSON.stringify({ next_stage: "task_preview" })
    });
    await updateSession();
  };

  const getOptionState = (optId) => {
    if (!submitted || !result?.all_options) return null;
    return result.all_options.find(o => o.id === optId);
  };

  // Рендер cloze-текста с пропусками под drag&drop/клик-вставку
  const renderClozeText = () => {
    if (!clozeData.marked_text) return null;
    const parts = [];
    let lastIndex = 0;
    const regex = /\{\{(\d+)\}\}/g;
    let match;

    while ((match = regex.exec(clozeData.marked_text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`t-${lastIndex}`}>{clozeData.marked_text.substring(lastIndex, match.index)}</span>
        );
      }
      const pos = parseInt(match[1]);
      const currentVal = clozeAnswers[String(pos)] || "";

      // Проверяем результат для этого пропуска
      const isCorrectPos = clozeResult?.correct_positions?.includes(pos);
      const wrongInfo = clozeResult?.wrong_positions?.find(w => w.position === pos);
      const hasResult = clozeResult !== null;

      parts.push(
        <button
          key={`slot-${pos}`}
          type="button"
          onClick={() => setActiveClozeBlank(pos)}
          onDragOver={(e) => !clozeResult?.passed && e.preventDefault()}
          onDrop={(e) => handleDropClozeWord(pos, e)}
          onDragEnter={() => !clozeResult?.passed && setActiveClozeBlank(pos)}
          disabled={clozeResult?.passed}
          className={`inline-flex items-center mx-1 min-w-[120px] min-h-[32px] px-3 py-1.5 border-2 rounded-lg text-sm font-medium text-left transition-all ${
            hasResult && isCorrectPos
              ? "bg-emerald-100 border-emerald-400 text-emerald-800"
              : hasResult && wrongInfo
                ? "bg-red-100 border-red-400 text-red-800"
                : activeClozeBlank === pos
                  ? "border-blue-500 bg-blue-50 text-blue-900"
                  : "border-blue-300 bg-white hover:border-blue-400"
          }`}
        >
          {currentVal ? currentVal.trim() : <span className="text-slate-300 select-none">{"\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"}</span>}
        </button>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < clozeData.marked_text.length) {
      parts.push(
        <span key="t-end">{clozeData.marked_text.substring(lastIndex)}</span>
      );
    }
    return parts;
  };

  // ====================== ШАГ 2: CLOZE ======================
  if (step === "cloze") {
  return (
    <div className="max-w-4xl mx-auto">
        {/* Вводный текст */}
        <div className="card p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">✍️</span>
            </div>
            <div className="flex-1">
              <p className="text-slate-700 text-lg leading-relaxed">
                Теперь сформулируйте типовую задачу самостоятельно, заполнив пропуски в тексте.
              </p>
            </div>
          </div>
        </div>

        {/* Задание */}
        <div className="card p-6 mb-6 bg-amber-50 border-amber-200">
          <h3 className="font-bold text-lg text-amber-900 mb-1">📝 Задание</h3>
          <p className="text-amber-800">
            Заполните пропуски, чтобы получилась формулировка типовой задачи для данной системы знаний.
          </p>
        </div>

        {/* Результат */}
        {clozeResult && (
          <div className={`card p-6 mb-6 ${clozeResult.passed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${clozeResult.passed ? "bg-emerald-100" : "bg-red-100"}`}>
                <span className="text-3xl">{clozeResult.passed ? "✅" : "❌"}</span>
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${clozeResult.passed ? "text-emerald-800" : "text-red-800"}`}>
                  {clozeResult.passed 
                    ? "Отлично! Формулировка заполнена верно." 
                    : `Есть ошибки (${clozeResult.score}% правильно). Попробуйте ещё раз.`}
            </h3>
                {!clozeResult.passed && clozeResult.wrong_positions?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {clozeResult.wrong_positions.map((w, i) => (
                      <p key={i} className="text-sm text-red-600">
                        Пропуск {w.position + 1}: вы выбрали «{w.student || "—"}», правильно: «{w.correct}»
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Текст с пропусками + слова справа */}
        <div className="card p-8 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
            <div className="text-lg text-slate-800 leading-loose rounded-xl border border-amber-200 bg-amber-50 p-4">
              {renderClozeText()}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase text-slate-500 mb-2">Слова</p>
              <p className="text-xs text-slate-600 mb-3">
                Перетащите слово в пропуск или нажмите на слово после выбора пропуска.
              </p>
              <div className="flex flex-wrap gap-2">
                {remainingClozeOptionWords.map((opt, i) => (
                  <button
                    key={`${opt}-${i}`}
                    type="button"
                    draggable={!clozeResult?.passed}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", opt.trim());
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => handlePickClozeWord(opt)}
                    className="relative px-3 py-1.5 pr-7 rounded-full bg-white border border-slate-300 text-sm hover:border-blue-400"
                    disabled={clozeResult?.passed}
                  >
                    {opt.trim()}
                    {remainingClozeOptionCounts[opt] > 1 && (
                      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                        {remainingClozeOptionCounts[opt]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (activeClozeBlank === null || activeClozeBlank === undefined) return;
                  handleClozeAnswer(activeClozeBlank, "");
                }}
                className="mt-4 text-xs text-slate-600 hover:text-slate-900 underline"
                disabled={clozeResult?.passed}
              >
                Очистить выбранный пропуск
              </button>
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex justify-between items-center">
          <div>
            {clozeResult && !clozeResult.passed && (
              <button onClick={handleClozeRetry} className="btn-outline">
                Попробовать ещё раз
              </button>
            )}
          </div>
          <div>
            {!clozeResult?.passed ? (
              <button
                onClick={handleClozeCheck}
                disabled={clozeChecking || Object.keys(clozeAnswers).length < (clozeData.blanks_count || 0)}
                className="btn-primary btn-lg"
              >
                {clozeChecking ? "Проверка..." : "Проверить"}
              </button>
            ) : (
              <button onClick={handleContinue} className="btn-primary btn-lg">
                Продолжить →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ====================== ШАГ 1: ВЫБОР ИЗ ВАРИАНТОВ ======================
  return (
    <div className="max-w-4xl mx-auto">
      {/* Вводный текст */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🎯</span>
          </div>
          <div className="flex-1">
            <p className="text-slate-700 text-lg leading-relaxed">
              Модели равномерного и неравномерного движения на участке траектории описывают множество конкретных ситуаций движения. 
              Это могут быть разные движущиеся тела; одно или два тела, движущиеся в одном или разных направлениях и т.п.
                </p>
              </div>
              </div>
      </div>

      {/* Задание */}
      <div className="card p-6 mb-6 bg-amber-50 border-amber-200">
        <h3 className="font-bold text-lg text-amber-900 mb-1">📝 Задание</h3>
        <p className="text-amber-800">
          С какой целью и в каких ситуациях можно применить эту систему знаний? 
          Выберите формулировку, которая наиболее точно описывает типовую задачу.
              </p>
            </div>

      {/* Результат */}
      {submitted && result && (
        <div className={`card p-6 mb-6 ${result.is_correct ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${result.is_correct ? "bg-emerald-100" : "bg-red-100"}`}>
              <span className="text-3xl">{result.is_correct ? "✅" : "❌"}</span>
        </div>
            <div className="flex-1">
              <h3 className={`text-lg font-bold ${result.is_correct ? "text-emerald-800" : "text-red-800"}`}>
                {result.is_correct ? "Верно! Вы правильно определили типовую задачу." : "Не совсем верно. Посмотрите пояснения к вариантам."}
              </h3>
              <p className={`text-sm mt-1 ${result.is_correct ? "text-emerald-600" : "text-red-600"}`}>
                {result.explanation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Варианты ответа */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        {options.map((opt, idx) => {
          const optState = getOptionState(opt.id);
          const isSelected = selectedId === opt.id;
          const letter = String.fromCharCode(1040 + idx); // А, Б, В, Г, Д, Е

          let borderClass = "border-slate-200 hover:border-blue-400";
          let bgClass = "bg-white";
          
          if (submitted && optState) {
            if (result?.is_correct && optState.is_correct) {
              // Правильный ответ — подсвечиваем зелёным только если ученик ответил верно
              borderClass = "border-emerald-400";
              bgClass = "bg-emerald-50";
            } else if (isSelected && !optState.is_correct) {
              // Выбранный неправильный — подсвечиваем красным
              borderClass = "border-red-400";
              bgClass = "bg-red-50";
            } else {
              // Остальные — приглушаем
              borderClass = "border-slate-200";
              bgClass = "bg-white opacity-60";
            }
          } else if (isSelected) {
            borderClass = "border-indigo-500 ring-2 ring-indigo-200";
            bgClass = "bg-indigo-50";
          }

          return (
            <button
              key={opt.id}
              onClick={() => !submitted && setSelectedId(opt.id)}
              disabled={submitted}
              className={`w-full text-left rounded-xl p-5 border-2 transition-all ${borderClass} ${bgClass} ${!submitted ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-lg
                  ${submitted && result?.is_correct && optState?.is_correct ? "bg-emerald-200 text-emerald-800" : 
                    submitted && isSelected && !optState?.is_correct ? "bg-red-200 text-red-800" :
                    isSelected ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {submitted && result?.is_correct && optState?.is_correct ? "✓" : 
                   submitted && isSelected && !optState?.is_correct ? "✗" : letter}
                </div>
                <div className="flex-1">
                  <p className={`leading-relaxed ${
                    submitted && result?.is_correct && optState?.is_correct ? "text-emerald-900 font-medium" :
                    submitted && isSelected && !optState?.is_correct ? "text-red-900" :
                    "text-slate-800"
                  }`}>
                    {opt.text}
                  </p>
                  {/* При неправильном ответе — показываем пояснение только к выбранному варианту */}
                  {submitted && optState && optState.explanation && (
                    (result?.is_correct && (optState.is_correct || isSelected)) ||
                    (!result?.is_correct && isSelected)
                  ) && (
                    <p className={`text-sm mt-2 italic ${
                      result?.is_correct && optState.is_correct ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {optState.explanation}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Кнопки */}
      <div className="flex justify-between items-center">
        <div>
          {submitted && !result?.is_correct && (
            <button onClick={handleRetryChoice} className="btn-outline">
              Попробовать ещё раз
            </button>
          )}
        </div>
        <div>
          {!submitted ? (
          <button 
              onClick={handleSubmit}
              disabled={!selectedId || submitting}
            className="btn-primary btn-lg"
          >
              {submitting ? "Проверка..." : "Ответить"}
            </button>
          ) : result?.is_correct ? (
            hasCloze ? (
              <button onClick={handleGoToCloze} className="btn-primary btn-lg">
                Далее: сформулируйте сами →
              </button>
            ) : (
              <button onClick={handleContinue} className="btn-primary btn-lg">
            Продолжить →
          </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STAGE: TASK PREVIEW (Слайд 7 - Ознакомление с заданием)
// ============================================================================

function StageTaskPreview() {
  const { ksData, session, updateSession } = useApp();
  const [taskTexts, setTaskTexts] = useState([]);
  const [expandedTask, setExpandedTask] = useState(null);

  useEffect(() => {
    if (ksData.tasks && ksData.tasks.length > 0) {
      setTaskTexts(
        ksData.tasks
          .slice()
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((task) => ({
            order: task.order,
            text: task.text || "",
          }))
      );
    }
  }, [ksData]);

  const handleContinue = async () => {
    await fetch(`/api/session/${session.id}/advance_stage/`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFCookie()
      },
      body: JSON.stringify({ next_stage: "task_list" })
    });
    await updateSession();
  };

  const taskFormulation = DEFAULT_TASK_FORMULATION;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">👀</span>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">Ознакомьтесь с заданием</h2>
            <p className="text-slate-600 leading-relaxed">
              Нажмите на ситуацию, чтобы прочитать условие. Затем переходите к решению.
            </p>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-6">
          <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Задание</h3>
          <p className="text-indigo-950 font-semibold text-lg leading-relaxed">{taskFormulation}</p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 mb-6 divide-y divide-slate-200">
          {taskTexts.length === 0 ? (
            <p className="text-slate-500 p-4">Загрузка...</p>
          ) : (
            taskTexts.map((task) => {
              const isOpen = expandedTask === task.order;
              const preview = task.text.length > 80 ? task.text.slice(0, 80) + "..." : task.text;
              return (
                <button
                  key={task.order}
                  type="button"
                  onClick={() => setExpandedTask(isOpen ? null : task.order)}
                  className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="task-pill w-8 h-8 text-sm flex-shrink-0">{task.order}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-700">Ситуация {task.order}</span>
                      {!isOpen && <p className="text-xs text-slate-400 truncate mt-0.5">{preview}</p>}
                    </div>
                    <span className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>&#9660;</span>
                  </div>
                  {isOpen && (
                    <p className="text-slate-800 leading-relaxed whitespace-pre-line mt-3 ml-11 text-[0.95rem]">{task.text}</p>
                  )}
                </button>
              );
            })
          )}
        </div>

        <button
          onClick={handleContinue}
          className="btn-primary btn-lg w-full"
        >
          Далее к решению первой задачи
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STAGE: LEARNING PATH CHOICE (Слайд 8 - Выбор порядка работы)
// ============================================================================

function StageLearningPathChoice() {
  const { session, updateSession } = useApp();
  const [submittingPath, setSubmittingPath] = useState("");

  const handleSelect = async (learningPath) => {
    if (!session?.id || submittingPath) return;
    setSubmittingPath(learningPath);
    try {
      try {
        window.localStorage.setItem("eora_learning_path", learningPath);
      } catch {
        // ignore
      }
      await ensureCSRFCookie();
      const res = await fetch(`/api/session/${session.id}/set_learning_path/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ learning_path: learningPath })
      });

      if (!res.ok) {
        let message = "Не удалось сохранить выбор";
        try {
          const err = await res.json();
          message = err?.detail || message;
        } catch {
          const raw = await res.text();
          const pageTitle = parseHtmlErrorInfo(raw);
          const redirectedHint = res.redirected ? `, redirect: ${res.url}` : "";
          message = `HTTP ${res.status}${redirectedHint}${pageTitle ? `, page: ${pageTitle}` : ""}`;
        }
        throw new Error(message);
      }

      await updateSession();
    } catch (e) {
      alert("Ошибка: " + e.message);
    } finally {
      setSubmittingPath("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card p-6 md:p-8">
        <div className="eora-screen-header max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Порядок работы с материалом</h2>
          <p className="eora-screen-lead">
            Выбери, как тебе удобнее начать.
          </p>
        </div>

        <div className="space-y-3 stagger-children">
          <button
            onClick={() => handleSelect("self_solve")}
            disabled={!!submittingPath}
            className="w-full card-interactive p-5 md:p-6 text-left hover:border-emerald-400 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="eora-option-badge eora-option-badge--easy">С</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-0.5 text-slate-900">Самостоятельное решение</h3>
                <p className="text-sm text-slate-600">Задание понятно; опираюсь на условие и изученный метод.</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelect("review_example")}
            disabled={!!submittingPath}
            className="w-full card-interactive p-5 md:p-6 text-left hover:border-amber-400 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="eora-option-badge eora-option-badge--medium">П</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-0.5 text-slate-900">Сначала разбор примера</h3>
                <p className="text-sm text-slate-600">Нужен эталонный разбор перед самостоятельной работой.</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelect("discuss_and_review")}
            disabled={!!submittingPath}
            className="w-full card-interactive p-5 md:p-6 text-left hover:border-rose-400 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="eora-option-badge eora-option-badge--hard">У</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-0.5 text-slate-900">Разбор и поддержка</h3>
                <p className="text-sm text-slate-600">Нужны пояснение примера и обсуждение способа решения.</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BRANCHING — блок ошибок в задаче (2/3 ошибки)
// ============================================================================

function ErrorBranchingBlock({
  result,
  ksData,
  session,
  currentTaskId,
  handleNextTask,
  handleStartStepByStep,
  onAlgorithmViewed,
}) {
  const [showScenario631, setShowScenario631] = useState(false);
  const [scenarioAnswers, setScenarioAnswers] = useState({});
  const [activeBlank, setActiveBlank] = useState(null);
  const [scenarioChecked, setScenarioChecked] = useState(false);
  const [scenarioCheckMessage, setScenarioCheckMessage] = useState("");
  const [scenarioChecking, setScenarioChecking] = useState(false);
  const [twoErrorEventsCount, setTwoErrorEventsCount] = useState(0);
  const [handledTwoErrorTaskIds, setHandledTwoErrorTaskIds] = useState([]);

  // Стабильный ключ: без этого buildScenario631ClozeData() даёт новый объект на каждый рендер,
  // useEffect ниже срабатывает снова и сбрасывает scenarioChecked сразу после «Проверить».
  const scenarioClozeStableKey = useMemo(() => {
    const steps = ksData?.solution_method?.steps;
    if (!steps?.length) return null;
    return [...steps]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((s) => `${s.order ?? ""}\u001f${s.title ?? ""}\u001f${(s.description || "").slice(0, 240)}`)
      .join("\u001e");
  }, [ksData?.solution_method?.steps]);

  // Только scenarioClozeStableKey в deps: иначе новая ссылка ksData после updateSession()
  // снова создаёт новый scenarioCloze и ломает стабильность.
  const scenarioCloze = useMemo(() => {
    if (!scenarioClozeStableKey) return null;
    return buildScenario631ClozeData(ksData);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно только ключ шагов метода
  }, [scenarioClozeStableKey]);

  const wrongCount = result?.task_wrong_attempts_count || 0;
  const hasAlgorithm = ksData?.solution_method?.steps?.length > 0;
  const isMediumDifficulty = session?.difficulty_choice === "medium";
  const storageScopeKey = `${session?.id || "no-session"}_${ksData?.id || "no-ks"}`;
  const twoErrorsCountStorageKey = `eora_two_errors_count_${storageScopeKey}`;
  const twoErrorsHandledTasksStorageKey = `eora_two_errors_tasks_${storageScopeKey}`;

  useEffect(() => {
    try {
      const rawCount = window.localStorage.getItem(twoErrorsCountStorageKey);
      const rawTasks = window.localStorage.getItem(twoErrorsHandledTasksStorageKey);
      const parsedCount = Number.parseInt(rawCount || "0", 10);
      const parsedTasks = JSON.parse(rawTasks || "[]");
      setTwoErrorEventsCount(Number.isFinite(parsedCount) ? parsedCount : 0);
      setHandledTwoErrorTaskIds(Array.isArray(parsedTasks) ? parsedTasks : []);
    } catch {
      setTwoErrorEventsCount(0);
      setHandledTwoErrorTaskIds([]);
    }
  }, [twoErrorsCountStorageKey, twoErrorsHandledTasksStorageKey]);

  useEffect(() => {
    if (wrongCount < 2 || !currentTaskId) return;
    if (handledTwoErrorTaskIds.includes(currentTaskId)) return;

    const nextCount = twoErrorEventsCount + 1;
    const nextHandled = [...handledTwoErrorTaskIds, currentTaskId];
    setTwoErrorEventsCount(nextCount);
    setHandledTwoErrorTaskIds(nextHandled);
    try {
      window.localStorage.setItem(twoErrorsCountStorageKey, String(nextCount));
      window.localStorage.setItem(twoErrorsHandledTasksStorageKey, JSON.stringify(nextHandled));
    } catch {
      // ignore storage errors
    }
  }, [
    wrongCount,
    currentTaskId,
    handledTwoErrorTaskIds,
    twoErrorEventsCount,
    twoErrorsCountStorageKey,
    twoErrorsHandledTasksStorageKey,
  ]);

  const shouldShowManualComposition =
    !!hasAlgorithm &&
    !!scenarioClozeStableKey &&
    !!scenarioCloze &&
    (
      (!isMediumDifficulty && twoErrorEventsCount === 1) ||
      (isMediumDifficulty && twoErrorEventsCount >= 3)
    );
  // Модель ветвления:
  // 2 ошибки: ветка зависит от уровня сложности и номера такого случая за сессию.
  // 3 ошибки -> пооперационный контроль.
  useEffect(() => {
    if (wrongCount < 2) {
      setShowScenario631(false);
      setScenarioChecked(false);
      setScenarioCheckMessage("");
      setScenarioAnswers({});
    }
    if (wrongCount >= 3) {
      handleStartStepByStep();
      return;
    }
    if (
      wrongCount >= 2 &&
      shouldShowManualComposition
    ) {
      setShowScenario631(true);
      setScenarioChecked(false);
      setScenarioCheckMessage("");
    } else if (wrongCount >= 2) {
      setShowScenario631(false);
    }
  }, [
    wrongCount,
    shouldShowManualComposition,
    handleStartStepByStep,
  ]);

  const handleScenarioCheck = async () => {
    if (!scenarioCloze) return;
    setScenarioChecking(true);
    setScenarioCheckMessage("");
    try {
      const ok = scenarioCloze.blanks.every(
        (blank) => (scenarioAnswers[String(blank.position)] || "").trim().toLowerCase() === blank.correct.trim().toLowerCase()
      );
      setScenarioChecked(ok);
      if (!ok) {
        setScenarioCheckMessage("Есть неточности в заполнении. Проверьте пропуски и попробуйте снова.");
      }
    } catch (e) {
      setScenarioCheckMessage(e.message || "Ошибка проверки");
    } finally {
      setScenarioChecking(false);
    }
  };

  // Сначала 3 ошибки (иначе кратковременно может показаться cloze от 2 ошибок)
  if (wrongCount >= 3) {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-900 text-sm">Неверно.</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-blue-600 text-sm font-medium py-4">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Переход к пошаговому разбору...
        </div>
      </div>
    );
  }

  if (showScenario631 && scenarioCloze) {
    const renderedPositions = Array.from(
      new Set(
        [...scenarioCloze.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => parseInt(m[1], 10))
      )
    );
    const isComplete = renderedPositions.every((pos) => !!scenarioAnswers[String(pos)]);
    const selectedScenarioWords = Object.values(scenarioAnswers).filter(Boolean);
    const scenarioWordUsage = selectedScenarioWords.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
    const remainingScenarioOptions = [];
    scenarioCloze.options.forEach((word) => {
      if (scenarioWordUsage[word]) {
        scenarioWordUsage[word] -= 1;
      } else {
        remainingScenarioOptions.push(word);
      }
    });
    const remainingScenarioOptionCounts = remainingScenarioOptions.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
    const remainingScenarioOptionWords = Object.keys(remainingScenarioOptionCounts);
    const handlePickWord = (word) => {
      const targetPos = activeBlank ?? renderedPositions.find((pos) => !scenarioAnswers[String(pos)]);
      if (targetPos === undefined || targetPos === null) return;
      setScenarioAnswers((prev) => ({ ...prev, [String(targetPos)]: word }));
      setActiveBlank(null);
    };
    const handleDropWord = (pos, event) => {
      event.preventDefault();
      const droppedWord = event.dataTransfer.getData("text/plain");
      if (!droppedWord) return;
      setScenarioAnswers((prev) => ({ ...prev, [String(pos)]: droppedWord }));
      setActiveBlank(null);
    };

    const renderScenarioText = () => {
      const nodes = [];
      let cursor = 0;
      const regex = /\{\{(\d+)\}\}/g;
      let match;
      while ((match = regex.exec(scenarioCloze.text)) !== null) {
        if (match.index > cursor) {
          nodes.push(<span key={`t-${cursor}`}>{scenarioCloze.text.substring(cursor, match.index)}</span>);
        }
        const pos = parseInt(match[1], 10);
        const selectedValue = scenarioAnswers[String(pos)] || "";
        nodes.push(
          <button
            key={`slot-${pos}`}
            type="button"
            onClick={() => setActiveBlank(pos)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropWord(pos, e)}
            onDragEnter={() => setActiveBlank(pos)}
            className={`inline-flex items-center mx-1 my-1 min-w-[120px] min-h-[32px] px-3 py-1.5 rounded-lg border text-sm text-left transition-colors ${
              activeBlank === pos
                ? "border-blue-500 bg-blue-50 text-blue-900"
                : selectedValue
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-amber-300 bg-white text-slate-500"
            }`}
          >
            {selectedValue ? selectedValue.trim() : <span className="text-slate-300 select-none">{"\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"}</span>}
          </button>
        );
        cursor = regex.lastIndex;
      }
      if (cursor < scenarioCloze.text.length) {
        nodes.push(<span key="t-end">{scenarioCloze.text.substring(cursor)}</span>);
      }
      return nodes;
    };

    return (
      <FullScreenModal>
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Задание непростое. Нужно обдумать метод решения</h3>
            <p className="text-sm text-slate-600 mt-2">
              Вставьте слова из облака в шаги типового метода, затем вернитесь к задаче.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 leading-8 whitespace-pre-line">
                {renderScenarioText()}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase text-slate-500 mb-2">Слова справа</p>
                <p className="text-xs text-slate-600 mb-3">
                  Перетащите слово в пропуск слева или вставьте по клику.
                </p>
                <div className="flex flex-wrap gap-2">
                  {remainingScenarioOptionWords.map((opt, idx) => (
                    <button
                      key={`${opt}-${idx}`}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", opt.trim());
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handlePickWord(opt)}
                      className="relative px-3 py-1.5 pr-7 rounded-full bg-white border border-slate-300 text-sm hover:border-blue-400"
                    >
                      {opt.trim()}
                      {remainingScenarioOptionCounts[opt] > 1 && (
                        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                          {remainingScenarioOptionCounts[opt]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (activeBlank === null || activeBlank === undefined) return;
                    setScenarioAnswers((prev) => ({ ...prev, [String(activeBlank)]: "" }));
                  }}
                  className="mt-4 text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  Очистить выбранный пропуск
                </button>
              </div>
            </div>
            {scenarioChecked && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 text-sm">
                Отлично! Метод восстановлен, можно продолжить решение.
              </div>
            )}
            {!!scenarioCheckMessage && !scenarioChecked && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                {scenarioCheckMessage}
              </div>
            )}
          </div>
          <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
            {!scenarioChecked ? (
              <button
                type="button"
                onClick={handleScenarioCheck}
                disabled={!isComplete || scenarioChecking}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scenarioChecking ? "Проверка..." : "Проверить"}
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  setShowScenario631(false);
                  if (onAlgorithmViewed) onAlgorithmViewed();
                  handleNextTask();
                }}
                className="btn-primary"
              >
                Продолжить решение →
              </button>
            )}
          </div>
        </div>
      </FullScreenModal>
    );
  }

  // 2 ошибки — лёгкая подсказка (read-only алгоритм), если cloze уже проходили или нет данных для cloze
  if (wrongCount >= 2 && hasAlgorithm) {
    return (
      <FullScreenModal>
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">💡</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Вспомни алгоритм решения</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {isMediumDifficulty
                    ? "Сверьте свой ход с общим порядком действий и попробуйте снова."
                    : "Кажется, с этим заданием пока не всё получается. Посмотри общий порядок решения задач такого типа — это поможет найти правильный подход."}
                </p>
              </div>
            </div>
          </div>
          {/* Изображение системы знаний */}
          {ksData.comprehension_image_url && (
            <div className="px-6 pt-4">
              <div className="text-xs text-slate-500 mb-2">Таблица системы знаний</div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <img
                  src={ksData.comprehension_image_url}
                  alt="Система знаний"
                  className="w-full max-h-[260px] object-contain bg-white"
                />
              </div>
            </div>
          )}
          {/* Компактный алгоритм */}
          <div className="p-5 space-y-2">
            {ksData.solution_method.steps.map((step) => (
              <div key={step.order} className="flex items-start gap-2.5 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-white text-xs font-bold flex-shrink-0 mt-0.5">
                  {step.order}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm text-slate-900 leading-snug">{step.title}</div>
                  {step.description && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{step.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Кнопка */}
          <div className="p-5 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                if (onAlgorithmViewed) onAlgorithmViewed();
                handleNextTask();
              }}
              className="btn-primary btn-lg w-full"
            >
              Понял, попробую ещё раз
            </button>
          </div>
        </div>
      </FullScreenModal>
    );
  }

  // < 2 ошибок — обычное сообщение
  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-900 text-sm">Неверно. Попробуйте ещё раз.</p>
      </div>
      <button
        onClick={handleNextTask}
        className="btn-outline btn-lg w-full"
      >
        Попробовать снова
      </button>
    </div>
  );
}

// ============================================================================
// STAGE: TASK LIST (Слайд 9-10 - Последовательное решение задач)
// ============================================================================

function StageTaskList() {
  const { session, ksData, updateSession } = useApp();
  const [currentTask, setCurrentTask] = useState(null);
  const [taskProgress, setTaskProgress] = useState(null);
  const [answer, setAnswer] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  /** Локальные фото перед отправкой: { id, file, previewUrl } */
  const [answerPhotos, setAnswerPhotos] = useState([]);

  const clearAnswerPhotos = () => {
    setAnswerPhotos((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      return [];
    });
  };

  const addAnswerPhotosFromFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setAnswerPhotos((prev) => {
      const room = MAX_ANSWER_PHOTOS - prev.length;
      if (room <= 0) return prev;
      const slice = files.slice(0, room);
      return [
        ...prev,
        ...slice.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];
    });
  };

  const removeAnswerPhoto = (id) => {
    setAnswerPhotos((prev) => {
      const x = prev.find((p) => p.id === id);
      if (x?.previewUrl) URL.revokeObjectURL(x.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };
  const [pendingDifficulty, setPendingDifficulty] = useState("");
  const [savingDifficulty, setSavingDifficulty] = useState(false);
  const [result, setResult] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasSeenAlgorithmHelp, setHasSeenAlgorithmHelp] = useState(false);
  const [showAlgorithmHelp, setShowAlgorithmHelp] = useState(false);
  const [showFinalTaskIntro, setShowFinalTaskIntro] = useState(false);
  const [showTaskOnboarding, setShowTaskOnboarding] = useState(() => {
    try { return !window.localStorage.getItem("eora_task_onboarding_done"); } catch { return true; }
  });

  const loadNextTask = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/session/${session.id}/next_task/`);
      if (res.ok) {
    const data = await res.json();
        if (data.is_completed) {
          setCurrentTask(null);
          setTaskProgress({
            tasks_solved: data.tasks_solved,
            tasks_correct: data.tasks_correct,
            target_tasks_count: data.target_tasks_count ?? session.target_tasks_count,
            remaining_tasks: 0,
          });
          await updateSession();
        } else {
          const prevTaskId = currentTask?.id ?? null;
          setCurrentTask(data.task);
          if (prevTaskId != null && data.task?.id != null && data.task.id !== prevTaskId) {
            setShowTaskOnboarding(false);
          }
          setSelectedUnit(
            data.task?.answer_unit ||
            data.task?.allowed_answer_units?.[0] ||
            ""
          );
          setTaskProgress({
            tasks_solved: data.tasks_solved,
            tasks_correct: data.tasks_correct,
            target_tasks_count: data.target_tasks_count,
            remaining_tasks: data.remaining_tasks,
          });
          setAnswer("");
          clearAnswerPhotos();
          setPendingDifficulty("");
          setResult(null);
          setShowSolution(false);
          const nextTaskNumber = (data.tasks_solved ?? 0) + 1;
          const nextTarget = effectiveTaskTrackTarget({ target_tasks_count: data.target_tasks_count }, session);
          const shouldShowFinalIntro = nextTaskNumber === nextTarget;
          if (shouldShowFinalIntro) {
            try {
              const key = `eora_final_task_intro_seen_${session.id}_${nextTaskNumber}`;
              if (!window.localStorage.getItem(key)) {
                setShowFinalTaskIntro(true);
              } else {
                setShowFinalTaskIntro(false);
              }
            } catch {
              setShowFinalTaskIntro(true);
            }
          } else {
            setShowFinalTaskIntro(false);
          }
        }
      } else {
        throw new Error("Ошибка загрузки задачи");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Загружаем следующую задачу
  useEffect(() => {
    if (session?.id) {
      loadNextTask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const handleSubmit = async () => {
    if (!currentTask || !answer?.trim()) return;
    const targetSlotsSubmit = effectiveTaskTrackTarget(taskProgress, session);
    const situationSubmit = (taskProgress?.tasks_solved ?? 0) + 1;
    const photoNeededSubmit = situationSubmit === targetSlotsSubmit && answerPhotos.length === 0;
    if (photoNeededSubmit) {
      alert(
        "Для последней ситуации в этой работе нужно прикрепить хотя бы одно фото решения из тетради (можно несколько снимков).",
      );
      return;
    }
    setSubmitting(true);
    try {
      const numericAnswer = Number.parseFloat(answer);
      if (Number.isNaN(numericAnswer)) {
        throw new Error("Введите корректное числовое значение");
      }
      await ensureCSRFCookie();
      const formData = new FormData();
      formData.append("session_id", String(session.id));
      formData.append("answer_numeric", String(numericAnswer));
      if (selectedUnit) {
        formData.append("answer_unit", selectedUnit);
      }
      answerPhotos.forEach((p) => {
        formData.append("answer_images", p.file);
      });
      const res = await fetch(`/api/task/${currentTask.id}/submit/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken": getCSRFCookie()
        },
        body: formData
      });
      const contentType = res.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const raw = await res.text();
        const pageTitle = parseHtmlErrorInfo(raw);
        const redirectedHint = res.redirected ? `, redirect: ${res.url}` : "";
        const authHint = raw.includes("<!DOCTYPE")
          ? `Сервер вернул HTML вместо JSON (HTTP ${res.status}${redirectedHint}${pageTitle ? `, page: ${pageTitle}` : ""}). Откройте вход на этом сайте: ${window.location.origin}/app/`
          : raw;
        throw new Error(authHint);
      }

      if (!res.ok) {
        throw new Error(data?.detail || "Не удалось отправить ответ");
      }

    setResult(data);
      // Обновляем прогресс
      await updateSession();
      // Обновляем локальный прогресс
      if (taskProgress) {
        setTaskProgress({
          tasks_solved: data.tasks_solved_count,
          tasks_correct: data.tasks_correct_count,
          target_tasks_count: taskProgress.target_tasks_count,
          remaining_tasks: Math.max(0, taskProgress.target_tasks_count - data.tasks_solved_count),
        });
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextTask = async () => {
    if (result?.is_correct) {
      // Переходим к следующей задаче
      try {
        await ensureCSRFCookie();
        const res = await fetch(`/api/session/${session.id}/move_to_next_task/`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFCookie()
          }
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.detail || "Не удалось перейти к следующей задаче");
        }
        await updateSession();
        await loadNextTask();
      } catch (e) {
        alert("Ошибка: " + e.message);
      }
    } else {
      // Неправильный ответ - даем возможность повторить
      setAnswer("");
      clearAnswerPhotos();
      setResult(null);
      setShowSolution(false);
    }
  };

  const handleConfirmDifficulty = async () => {
    if (!pendingDifficulty) return;
    setSavingDifficulty(true);
    try {
      await ensureCSRFCookie();
      const res = await fetch(`/api/session/${session.id}/set_difficulty/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ difficulty: pendingDifficulty })
      });
      const diffData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(diffData?.detail || "Не удалось сохранить выбор трудности");
      }
      await updateSession();
      if (diffData?.next_stage === "task_list") {
        await loadNextTask();
      }
    } catch (e) {
      alert("Ошибка: " + e.message);
    } finally {
      setSavingDifficulty(false);
    }
  };

  const handleFinishTask6 = async () => {
    try {
      await ensureCSRFCookie();
      const res = await fetch(`/api/session/${session.id}/advance_stage/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ next_stage: "completed" })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Не удалось завершить обучение");
      }
      await updateSession();
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
  };

  const handleStartStepByStep = useCallback(async () => {
    if (!currentTask) return;
    try {
      await ensureCSRFCookie();
      const res = await fetch(`/api/session/${session.id}/advance_stage/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ next_stage: "step_by_step" })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Не удалось перейти к пооперационному контролю");
      }
      window.localStorage.setItem(STEP_BY_STEP_TASK_KEY, String(currentTask.id));
      await updateSession();
    } catch (e) {
      console.error("step_by_step transition failed:", e.message);
    }
  }, [currentTask, session, updateSession]);

  if (loading) {
    return <div className="card p-8 text-center">Загрузка задачи...</div>;
  }

  if (!currentTask && taskProgress) {
    // Все задачи решены
  return (
    <div className="max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎉</span>
          </div>
          <h2 className="text-2xl font-bold mb-4">Поздравляем!</h2>
          <p className="text-lg text-slate-600 mb-6">
            Вы успешно решили все задачи!
          </p>
          <div className="bg-slate-50 rounded-xl p-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600">{taskProgress.tasks_solved}</div>
                <div className="text-sm text-slate-600">Всего решено</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-emerald-600">{taskProgress.tasks_correct}</div>
                <div className="text-sm text-slate-600">Правильно</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentTask) {
    return <div className="card p-8 text-center">Нет доступных задач</div>;
  }

  const targetSlots = effectiveTaskTrackTarget(taskProgress, session);
  /** Номер ситуации в треке сессии (1…targetSlots), а не Task.order из БД */
  const taskNumber = (taskProgress?.tasks_solved ?? 0) + 1;
  const photoRequired = taskNumber === targetSlots;
  const needsDifficultyChoice = taskNumber === 1 && !session?.difficulty_choice;
  const finalReview = session?.final_review || null;
  const finalStatus = finalReview?.status || "";
  const finalPending = finalStatus === "pending";
  const finalRejected = finalStatus === "rejected";

  const taskOnboardingSteps = TASK_ONBOARDING_STEPS.filter(
    (s) => s.target !== "task-difficulty-card" || needsDifficultyChoice
  );

  return (
    <div className="max-w-3xl mx-auto px-2">
      {showTaskOnboarding && !result && currentTask && (
        <TaskOnboardingGuide
          key={`${session.id}-${currentTask.id}`}
          steps={taskOnboardingSteps}
          onClose={() => {
            setShowTaskOnboarding(false);
            try { window.localStorage.setItem("eora_task_onboarding_done", "1"); } catch { /* ignore */ }
          }}
        />
      )}

      {showFinalTaskIntro && (
        <FullScreenModal>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-[calc(100vw-2rem)] p-6 border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl">📌</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Последняя ситуация</h3>
                <p className="text-sm text-slate-600 mt-2">
                  Это последняя задача. Добавь хотя бы одно фото решения в тетради.
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  После отправки учитель проверит решение, и результат появится чуть позже.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  try { window.localStorage.setItem(`eora_final_task_intro_seen_${session.id}_${taskNumber}`, "1"); } catch { /* ignore */ }
                  setShowFinalTaskIntro(false);
                }}
                className="btn-primary flex-1"
              >
                Понятно
              </button>
              <button
                type="button"
                onClick={() => setShowFinalTaskIntro(false)}
                className="btn-outline flex-1"
              >
                Напомнить позже
              </button>
            </div>
          </div>
        </FullScreenModal>
      )}

      {/* Compact progress strip */}
      {taskProgress && (
        <div className="card px-5 py-3 mb-5 flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-700">
            Задача {taskNumber} из {targetSlots}
          </span>
          <div className="flex-1 progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, ((taskProgress.tasks_solved || 0) / Math.max(1, targetSlots)) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">
            {taskProgress.tasks_correct || 0} верно
          </span>
        </div>
      )}

      {finalPending && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-900">Отправлено учителю на проверку</p>
            <p className="text-sm text-blue-800 mt-1">Здесь появится результат, как только учитель всё проверит.</p>
          </div>
          <button
            type="button"
            onClick={async () => { try { await updateSession(); } catch { /* ignore */ } }}
            className="shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Обновить
          </button>
        </div>
      )}

      {finalRejected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5">
          <p className="text-sm font-semibold text-amber-900">
            Последнюю задачу нужно доработать
          </p>
          {finalReview?.teacher_comment ? (
            <p className="text-sm text-amber-800 mt-2 whitespace-pre-line">
              Комментарий учителя: {finalReview.teacher_comment}
            </p>
          ) : (
            <p className="text-sm text-amber-800 mt-1">
              Попробуй ещё раз: исправь решение и отправь заново.
            </p>
          )}
        </div>
      )}

      {/* Task card */}
      <div className="card p-6 md:p-8">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-5">
          <p className="text-indigo-900 text-sm font-medium">{DEFAULT_TASK_FORMULATION}</p>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="task-pill">{taskNumber}</span>
          <h3 className="text-2xl font-bold tracking-tight">Ситуация {taskNumber}</h3>
        </div>

        {/* Task text */}
        <div id="task-problem-card" className="bg-slate-50 rounded-xl p-5 md:p-6 border border-slate-200 mb-5">
          <p className="text-slate-800 leading-relaxed" style={{ fontSize: "1.15rem" }}>{currentTask.text}</p>
        </div>

        {/* Instruction hint */}
        {!result && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-indigo-800 mb-5 flex items-start gap-2.5">
            <span className="text-lg leading-none mt-0.5">📝</span>
            <span>
              {photoRequired
                ? "Решите в тетради, введите числовой ответ и приложите хотя бы одно чёткое фото решения (можно несколько снимков)."
                : "Решите в тетради, введите числовой ответ. При желании приложите фото решения (можно несколько снимков)."}
            </span>
          </div>
        )}

        {/* Answer section */}
        <div className="space-y-4">
            {needsDifficultyChoice && (
              <div id="task-difficulty-card" className="mb-2">
                <TaskDifficultyPickerLayout
                  embedded
                  selected={pendingDifficulty}
                  onPick={setPendingDifficulty}
                  disabled={savingDifficulty}
                  childrenAfterHint={
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={handleConfirmDifficulty}
                        disabled={!pendingDifficulty || savingDifficulty}
                        className="btn-primary w-full btn-lg rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingDifficulty ? "Сохраняем..." : "Подтвердить выбор трудности"}
                      </button>
                    </div>
                  }
                />
              </div>
            )}

            <div id="task-answer-card" className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <label className="block text-base font-semibold text-slate-900">Ответ</label>
                  <p className="text-sm text-slate-500 mt-1">Введите число и выберите удобные единицы измерения.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3 mb-4">
                <NumericAnswerInput
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Введите число"
                  className="input input-lg flex-1 no-number-spin"
                  disabled={result !== null || submitting}
                  aria-label="Числовой ответ на задачу"
                />
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  disabled={result !== null || submitting || !(currentTask.allowed_answer_units?.length)}
                  className="input input-lg"
                  aria-label="Единица измерения ответа"
                >
                  {(currentTask.allowed_answer_units?.length ? currentTask.allowed_answer_units : [currentTask.answer_unit || ""]).filter(Boolean).map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500">
                Базовая единица задачи: <span className="font-medium text-slate-700">{currentTask.answer_unit || "без единицы"}</span>
              </p>
            </div>

              <div id="task-photo-card" className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
                <label className="block text-sm font-semibold mb-1.5">
                  Фото решения{" "}
                  {photoRequired ? (
                    <span className="text-rose-600 font-medium">(обязательно для последней ситуации)</span>
                  ) : (
                    <span className="text-slate-500 font-normal">(необязательно)</span>
                  )}
                  <span className="text-slate-500 font-normal text-xs ml-1">до {MAX_ANSWER_PHOTOS} файлов</span>
                </label>
                <label
                  htmlFor={`answer-photo-${taskNumber}`}
                  className="photo-dropzone flex flex-col items-center gap-1 group"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (result !== null || submitting) return;
                    addAnswerPhotosFromFiles(e.dataTransfer.files);
                  }}
                >
                  <span className="icon">{answerPhotos.length ? "✅" : "📷"}</span>
                  <span className="text-sm text-slate-600 group-hover:text-indigo-700 transition-colors text-center px-2">
                    Нажмите или перетащите сюда изображения
                  </span>
                  <span className="text-xs text-slate-400">Можно выбрать несколько файлов сразу</span>
                </label>
                <input
                  id={`answer-photo-${taskNumber}`}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    addAnswerPhotosFromFiles(e.target.files);
                    e.target.value = "";
                  }}
                  className="sr-only"
                  disabled={result !== null || submitting}
                  aria-label="Загрузка фото решения"
                />
                {answerPhotos.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {answerPhotos.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        {p.previewUrl ? (
                          <img
                            src={p.previewUrl}
                            alt=""
                            className="h-12 w-12 rounded object-cover border border-slate-100 shrink-0"
                          />
                        ) : null}
                        <span className="flex-1 min-w-0 truncate text-slate-800">{p.file.name}</span>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-rose-600 hover:text-rose-800 font-medium"
                          disabled={result !== null || submitting}
                          onClick={() => removeAnswerPhoto(p.id)}
                        >
                          Удалить
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {!result ? (
                <button
                  id="task-submit-button"
                  onClick={handleSubmit}
                  disabled={
                    !answer ||
                    (photoRequired && answerPhotos.length === 0) ||
                    submitting ||
                    needsDifficultyChoice ||
                    (photoRequired && finalPending)
                  }
                  className="btn-primary btn-lg w-full"
                >
                  {submitting
                    ? "Проверка..."
                    : photoRequired && finalPending
                      ? "Ждёт проверки учителя"
                      : "Отправить ответ"}
                </button>
              ) : (
                <div className="space-y-4">
            {result?.is_final_grade_task ? (
              <>
                <div className="rounded-xl p-6 bg-blue-50 border-2 border-blue-200">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">📌</span>
                    <div>
                      <p className="font-bold text-xl text-blue-800">
                        Ответ отправлен.
                      </p>
                      <p className="text-sm text-blue-900 mt-2">
                        Ответ отправлен учителю.
                        {result?.teacher_review_status === "pending" && (
                          <span className="block mt-1 font-medium">Статус: ожидает проверки.</span>
                        )}
                        {result?.teacher_review_status === "accepted" && (
                          <span className="block mt-1 font-medium text-emerald-800">Статус: принято.</span>
                        )}
                        {result?.teacher_review_status === "rejected" && (
                          <span className="block mt-1 font-medium text-amber-800">Статус: на доработку.</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleFinishTask6}
                  className="btn-primary btn-lg w-full"
                >
                  Перейти в итоговое окно
                </button>
              </>
            ) : result.is_correct ? (
              <>
                {/* Правильный ответ */}
                <div className="result-success rounded-xl p-6 bg-emerald-50 border-2 border-emerald-300 animate-pop">
                  <div className="relative z-10 flex items-center gap-4">
                    <span className="text-4xl">🎉</span>
                    <div>
                      <p className="font-bold text-xl text-emerald-800">Правильно!</p>
                      <p className="text-sm text-emerald-700 mt-0.5">Отличная работа, так держать.</p>
                    </div>
                  </div>
                </div>

                {/* Предложение сравнить решение */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <p className="text-indigo-900 font-medium mb-2">
                    Сверь своё решение с образцом и проверь, всё ли верно.
                  </p>
                  <button
                    onClick={() => setShowSolution(!showSolution)}
                    className="btn-outline"
                  >
                    {showSolution ? "Скрыть пример решения" : "Показать пример решения"}
                  </button>
                </div>

                {showSolution && (
                  <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                    <h4 className="font-semibold mb-3">Правильное развёрнутое решение:</h4>
                    {result.solution_summary || result.solution_detailed || (result.solution_steps && result.solution_steps.length > 0) ? (
                      <div className="space-y-4">
                        {result.solution_summary && (
                          <div>
                            <p className="text-sm font-medium text-slate-600 mb-1">Краткое решение:</p>
                            <p className="text-slate-700 whitespace-pre-line">{result.solution_summary}</p>
                          </div>
                        )}
                        {result.solution_detailed && (
                          <div>
                            <p className="text-sm font-medium text-slate-600 mb-1">Развёрнутое решение:</p>
                            <p className="text-slate-700 whitespace-pre-line">{result.solution_detailed}</p>
                          </div>
                        )}
                        {result.solution_image_url && (
                          <div>
                            <p className="text-sm font-medium text-slate-600 mb-2">Схема решения:</p>
                            <img 
                              src={result.solution_image_url} 
                              alt="Решение" 
                              className="max-w-full rounded-lg border border-slate-300"
                            />
                          </div>
                        )}
                        {result.solution_steps && result.solution_steps.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-blue-300">
                            <p className="text-sm font-medium text-slate-600 mb-3">Решение по шагам:</p>
                            <div className="space-y-4">
                              {result.solution_steps.map((step, idx) => (
                                <div key={idx} className="bg-white rounded-lg p-4 border border-blue-200">
                                  <div className="flex items-start gap-3 mb-2">
                                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                                      {step.order}
                                    </div>
                                    <div className="flex-1">
                                      <h5 className="font-semibold text-slate-900">{step.step_title}</h5>
                                      {step.step_type === "text" && step.content && (
                                        <p className="text-sm text-slate-700 mt-2 whitespace-pre-line">{step.content}</p>
                                      )}
                                      {step.step_type === "schema" && step.schema_data && (
                                        <div className="mt-3">
                                          <Suspense fallback={<div className="text-sm text-slate-500">Загрузка схемы...</div>}>
                                            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                                              <SchemaEditor
                                                initialData={step.schema_data}
                                                readOnly={true}
                                                compact={true}
                                                width={700}
                                                height={400}
                                                isTeacher={false}
                                              />
                                            </div>
                                          </Suspense>
                                        </div>
                                      )}
                                      {step.image_url && (
                                        <img 
                                          src={step.image_url} 
                                          alt={`Шаг ${step.order}`}
                                          className="mt-2 max-w-md rounded-lg border border-slate-300"
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">Решение не добавлено</p>
                    )}
                  </div>
                )}

                <button 
                  onClick={handleNextTask}
                  className="btn-primary btn-lg w-full"
                >
                  Далее
                </button>
              </>
            ) : (
              <ErrorBranchingBlock
                result={result}
                ksData={ksData}
                session={session}
                currentTaskId={currentTask?.id}
                handleNextTask={handleNextTask}
                handleStartStepByStep={handleStartStepByStep}
                onAlgorithmViewed={() => {
                  setHasSeenAlgorithmHelp(true);
                  setShowAlgorithmHelp(false);
                }}
              />
            )}
                </div>
              )}
            </div>
        </div>
      {/* Плавающая кнопка-подсказка для повторного запуска onboarding по экрану задачи */}
      {!showTaskOnboarding && currentTask && !loading && (
        <button
          type="button"
          onClick={() => setShowTaskOnboarding(true)}
          className={`fixed right-6 z-[9000] w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-white shadow-xl flex items-center justify-center text-2xl hover:scale-105 transition-all ${
            hasSeenAlgorithmHelp && ksData?.solution_method?.steps?.length > 0 ? "bottom-20" : "bottom-6"
          }`}
          aria-label="Показать подсказки по экрану"
          title="Показать подсказки по экрану"
        >
          💡
        </button>
      )}

      {/* Плавающая кнопка-подсказка (лампочка) для алгоритма, если ученик уже видел модалку */}
      {hasSeenAlgorithmHelp && ksData?.solution_method?.steps?.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAlgorithmHelp(true)}
          className="fixed bottom-6 right-6 z-[9000] w-12 h-12 rounded-full bg-amber-400 text-white shadow-xl flex items-center justify-center text-2xl hover:bg-amber-500 transition-colors"
          aria-label="Показать алгоритм решения"
        >
          💡
        </button>
      )}

      {showAlgorithmHelp && ksData?.solution_method?.steps?.length > 0 && (
        <FullScreenModal>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 pb-4 border-b border-slate-100 flex items-start gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">💡</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Алгоритм решения задач для этой системы знаний</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Здесь собраны шаги, которые помогут тебе вспомнить общий порядок решения подобных задач.
                </p>
              </div>
            </div>

            {ksData.comprehension_image_url && (
              <div className="px-6 pt-4">
                <div className="text-xs text-slate-500 mb-2">Таблица системы знаний</div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <img
                    src={ksData.comprehension_image_url}
                    alt="Система знаний"
                    className="w-full max-h-[260px] object-contain bg-white"
                  />
                </div>
              </div>
            )}

            <div className="p-5 space-y-2">
              {ksData.solution_method.steps.map((step) => (
                <div
                  key={step.order}
                  className="flex items-start gap-2.5 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    {step.order}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-900 leading-snug">{step.title}</div>
                    {step.description && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{step.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAlgorithmHelp(false)}
                className="btn-secondary"
              >
                Закрыть
              </button>
            </div>
          </div>
        </FullScreenModal>
      )}
    </div>
  );
}

// ============================================================================
// STAGE: DIFFICULTY ASSESSMENT
// ============================================================================

function IconDifficultyBulb({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 21h6M10 18h4M12 3a5 5 0 0 1 3.9 8.1c-.5.6-.9 1.3-1.1 2.1-.2.8-.3 1.5-.3 2.3H9.5c0-.8-.1-1.5-.3-2.3-.2-.8-.6-1.5-1.1-2.1A5 5 0 0 1 12 3Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDifficultyBook({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 4v15.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDifficultyStar({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5l2.8 5.7 6.3.9-4.5 4.4 1.1 6.3L12 17.3 6.3 19.8l1.1-6.3-4.5-4.4 6.3-.9L12 2.5Z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DIFFICULTY_CARD_DEFS = [
  {
    key: "easy",
    title: "Лёгкое",
    body: "Попробую решить самостоятельно.",
    Icon: IconDifficultyBulb,
    ring: "ring-emerald-400/80",
    borderIdle: "border-emerald-200 hover:border-emerald-300",
    borderSelected: "border-emerald-500",
    iconWrap: "text-emerald-600 bg-emerald-50 border border-emerald-200/80",
    shadow: "shadow-sm shadow-emerald-900/5",
  },
  {
    key: "medium",
    title: "Непростое",
    body: "Хорошо бы сначала разобрать пример.",
    Icon: IconDifficultyBook,
    ring: "ring-amber-400/90",
    borderIdle: "border-amber-200 hover:border-amber-300",
    borderSelected: "border-amber-500",
    iconWrap: "text-amber-700 bg-amber-50 border border-amber-200/80",
    shadow: "shadow-sm shadow-amber-900/5",
  },
  {
    key: "hard",
    title: "Трудное",
    body: "Нужно обсудить способ решения и разобрать пример.",
    Icon: IconDifficultyStar,
    ring: "ring-orange-400/90",
    borderIdle: "border-orange-200 hover:border-orange-300",
    borderSelected: "border-orange-500",
    iconWrap: "text-orange-600 bg-orange-50 border border-orange-200/80",
    shadow: "shadow-sm shadow-orange-900/5",
  },
];

function TaskDifficultyPickerLayout({
  embedded,
  selected,
  onPick,
  disabled,
  childrenAfterHint,
}) {
  return (
    <div className={embedded ? "" : "max-w-5xl mx-auto"}>
      <div
        className={
          embedded
            ? "rounded-2xl border border-slate-200/80 bg-white p-5 md:p-7 shadow-sm"
            : "rounded-2xl border border-slate-200 bg-white p-6 md:p-10 shadow-md shadow-slate-900/5"
        }
      >
        {embedded ? (
          <div className="mb-6">
            <h4 className="font-semibold text-slate-900 mb-1">Оцените трудность первой задачи</h4>
            <p className="text-sm text-slate-600">
              Выбери вариант. Если нужно, выбор можно поменять.
            </p>
          </div>
        ) : (
          <div className="eora-screen-header max-w-2xl mx-auto mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Оценка трудности</h2>
            <p className="eora-screen-lead">
              Выбери, как тебе удобнее работать с задачей.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
          {DIFFICULTY_CARD_DEFS.map(({ key, title, body, Icon: IconComponent, ring, borderIdle, borderSelected, iconWrap, shadow }) => {
            const isOn = selected === key;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onPick(key)}
                className={`group relative flex flex-col items-center text-center rounded-2xl border-2 bg-white px-4 py-6 md:py-8 transition-all duration-200 ${shadow} ${
                  isOn ? `${borderSelected} ring-2 ring-offset-2 ${ring} scale-[1.01]` : `${borderIdle}`
                } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"}`}
              >
                <div
                  className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${iconWrap}`}
                >
                  {React.createElement(IconComponent, { className: "h-7 w-7" })}
                </div>
                <h3 className="text-base md:text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-[16rem] mx-auto">{body}</p>
              </button>
            );
          })}
        </div>

        {childrenAfterHint}
      </div>
    </div>
  );
}

function StageDifficultyAssessment() {
  const { session, updateSession } = useApp();
  const [busyKey, setBusyKey] = useState(null);

  const handleSelect = async (difficulty) => {
    setBusyKey(difficulty);
    try {
      await ensureCSRFCookie();
      const res = await fetch(`/api/session/${session.id}/set_difficulty/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ difficulty })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Не удалось сохранить выбор трудности");
      }
      await updateSession();
    } catch (e) {
      alert("Ошибка: " + e.message);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fadeIn">
      <TaskDifficultyPickerLayout
        embedded={false}
        selected={busyKey}
        onPick={handleSelect}
        disabled={!!busyKey}
      />
    </div>
  );
}

// ============================================================================
// STAGE: SOLVING (альтернативный экран; основной поток — StageTaskList на task_list)
// ============================================================================

function StageSolving() {
  const { ksData, session, updateSession } = useApp();
  const [currentTask, setCurrentTask] = useState(null);
  const [taskDetails, setTaskDetails] = useState(null);
  const [solvedTaskIds, setSolvedTaskIds] = useState(new Set());
  const [studentLevel, setStudentLevel] = useState(3); // L₀ = 3
  const [answer, setAnswer] = useState("");
  const [answerPhotos, setAnswerPhotos] = useState([]);
  const [result, setResult] = useState(null);
  const [showSolution, setShowSolution] = useState(false);

  const clearAnswerPhotos = () => {
    setAnswerPhotos((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      return [];
    });
  };
  const addAnswerPhotosFromFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setAnswerPhotos((prev) => {
      const room = MAX_ANSWER_PHOTOS - prev.length;
      if (room <= 0) return prev;
      const slice = files.slice(0, room);
      return [
        ...prev,
        ...slice.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];
    });
  };
  const removeAnswerPhoto = (id) => {
    setAnswerPhotos((prev) => {
      const x = prev.find((p) => p.id === id);
      if (x?.previewUrl) URL.revokeObjectURL(x.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const tasks = useMemo(() => ksData?.tasks || [], [ksData?.tasks]);

  const targetSlotsSolving = effectiveTaskTrackTarget(null, session);
  const situationSolving = (session?.tasks_solved_count ?? 0) + 1;
  const photoMandatorySolving = situationSolving === targetSlotsSolving;

  const targetTasks = effectiveTaskTrackTarget(null, session);

  // Выбор следующей задачи по алгоритму
  const selectNextTask = useCallback((currentLevel, solved) => {
    const availableTasks = tasks.filter(t => !solved.has(t.id));
    if (availableTasks.length === 0) return null;

    // Сортируем по близости к уровню ученика
    const sorted = availableTasks
      .map(t => ({
        task: t,
        distance: Math.abs(t.difficulty - currentLevel)
      }))
      .sort((a, b) => a.distance - b.distance);

    // Берём задачи с минимальным расстоянием
    const minDistance = sorted[0].distance;
    const candidates = sorted.filter(s => s.distance === minDistance);
    
    // Случайный выбор среди равноудалённых
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex].task;
  }, [tasks]);

  // Инициализация — выбираем первую задачу (пропускаем задачу 1, она была на ознакомлении)
  useEffect(() => {
    if (tasks.length > 0) {
      // Помечаем первую задачу как уже решённую (она была на этапе ознакомления)
      const initialSolved = new Set([tasks[0].id]);
      setSolvedTaskIds(initialSolved);
      
      const nextTask = selectNextTask(3, initialSolved);
      if (nextTask) {
        setCurrentTask(nextTask);
        loadTaskDetails(nextTask.id);
      }
    }
  }, [tasks, selectNextTask]);

  const loadTaskDetails = async (taskId) => {
    const res = await fetch(`/api/task/${taskId}/`);
    if (!res.ok) throw new Error("Не удалось загрузить условие задачи");
    const data = await res.json();
    setTaskDetails(data);
  };

  const handleSubmit = async () => {
    if (!taskDetails) return;
    if (photoMandatorySolving && answerPhotos.length === 0) {
      alert(
        "Для последней ситуации в этой работе нужно прикрепить хотя бы одно фото решения из тетради (можно несколько снимков).",
      );
      return;
    }
    try {
      const numericAnswer = Number.parseFloat(answer);
      if (Number.isNaN(numericAnswer)) {
        throw new Error("Введите корректное числовое значение");
      }
      await ensureCSRFCookie();
      const formData = new FormData();
      formData.append("session_id", String(session.id));
      formData.append("answer_numeric", String(numericAnswer));
      answerPhotos.forEach((p) => formData.append("answer_images", p.file));
      const res = await fetch(`/api/task/${taskDetails.id}/submit/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken": getCSRFCookie()
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Не удалось отправить ответ");
      setResult(data);
      await updateSession();

      // Обновляем уровень ученика по формуле
      // δ = +0.5 при правильном, -1.0 при неправильном
      const delta = data.is_correct ? 0.5 : -1.0;
      const newLevel = Math.max(1, Math.min(5, studentLevel + delta));
      setStudentLevel(newLevel);

    } catch (e) {
      alert("Ошибка: " + e.message);
    }
  };

  const handleNext = async () => {
    // Добавляем в решённые
    const newSolved = new Set([...solvedTaskIds, currentTask.id]);
    setSolvedTaskIds(newSolved);

    // Проверяем условие завершения
    const totalSolved = newSolved.size;
    if (totalSolved >= targetTasks || newSolved.size >= tasks.length) {
      // Завершаем обучение
      const res = await fetch(`/api/session/${session.id}/advance_stage/`, {
        method: "POST",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ next_stage: "completed" })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Не удалось завершить этап");
      }
      await updateSession();
      return;
    }

    // Выбираем следующую задачу по алгоритму
    const nextTask = selectNextTask(studentLevel, newSolved);
    if (nextTask) {
      setCurrentTask(nextTask);
      loadTaskDetails(nextTask.id);
      setAnswer("");
      clearAnswerPhotos();
      setResult(null);
      setShowSolution(false);
    }
  };

  if (!taskDetails) {
    return <div className="card p-8 text-center">Загрузка задачи...</div>;
  }

  const solvedCount = solvedTaskIds.size;
  const correctCount = session?.tasks_correct_count || 0;

  return (
    <div className="max-w-3xl mx-auto px-2">
      {/* Progress strip */}
      <div className="card px-5 py-3 mb-5 flex items-center gap-4">
        <span className="text-sm font-semibold text-slate-700">
          Задача {solvedCount + 1} из {targetTasks}
        </span>
        <div className="flex-1 progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(solvedCount / targetTasks) * 100}%` }}
          />
        </div>
        <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">
          {correctCount} верно
        </span>
      </div>

      {/* Current task */}
      <div className="card p-6 md:p-8">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-5">
          <p className="text-indigo-900 text-sm font-medium">{DEFAULT_TASK_FORMULATION}</p>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="task-pill">{currentTask?.order}</span>
          <h3 className="text-2xl font-bold tracking-tight">Ситуация {currentTask?.order}</h3>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 md:p-6 border border-slate-200 mb-5">
          <p className="text-slate-800 leading-relaxed" style={{ fontSize: "1.15rem" }}>{taskDetails.text}</p>
        </div>

        <SchemaEditorSection taskId={taskDetails.id} sessionId={session?.id} />

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2">Ваш ответ:</label>
          <div className="flex gap-3">
            <NumericAnswerInput
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Введите число"
              className="input input-lg flex-1 no-number-spin"
              disabled={result !== null}
            />
            <span className="self-center text-slate-500 font-semibold text-lg min-w-[60px]">
              {taskDetails.answer_unit || ""}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-1.5">
            Фото решения{" "}
            {photoMandatorySolving ? (
              <span className="text-rose-600 font-medium">(обязательно для последней ситуации)</span>
            ) : (
              <span className="text-slate-500 font-normal">(необязательно)</span>
            )}
            <span className="text-slate-500 font-normal text-xs ml-1">до {MAX_ANSWER_PHOTOS} файлов</span>
          </label>
          <label
            htmlFor="answer-photo-solving"
            className="photo-dropzone flex flex-col items-center gap-1 group"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (result !== null) return;
              addAnswerPhotosFromFiles(e.dataTransfer.files);
            }}
          >
            <span className="icon">{answerPhotos.length ? "✅" : "📷"}</span>
            <span className="text-sm text-slate-600 group-hover:text-indigo-700 transition-colors text-center px-2">
              Нажмите или перетащите изображения
            </span>
            <span className="text-xs text-slate-400">Можно выбрать несколько файлов</span>
          </label>
          <input
            id="answer-photo-solving"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              addAnswerPhotosFromFiles(e.target.files);
              e.target.value = "";
            }}
            className="sr-only"
            disabled={result !== null}
            aria-label="Загрузка фото решения"
          />
          {answerPhotos.length > 0 && (
            <ul className="mt-3 space-y-2">
              {answerPhotos.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {p.previewUrl ? (
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover border border-slate-100 shrink-0"
                    />
                  ) : null}
                  <span className="flex-1 min-w-0 truncate text-slate-800">{p.file.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-rose-600 hover:text-rose-800 font-medium"
                    disabled={result !== null}
                    onClick={() => removeAnswerPhoto(p.id)}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        {!result ? (
          <button
            onClick={handleSubmit}
            disabled={!answer || (photoMandatorySolving && answerPhotos.length === 0)}
            className="btn-primary btn-lg w-full"
          >
            Проверить ответ
          </button>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-xl p-6 ${
              result.is_correct
                ? "result-success bg-emerald-50 border-2 border-emerald-300 animate-pop"
                : "bg-red-50 border-2 border-red-200"
            }`}>
              <div className="relative z-10 flex items-center gap-4">
                <span className="text-4xl">{result.is_correct ? "🎉" : "😔"}</span>
                <div>
                  <p className={`font-bold text-xl ${result.is_correct ? "text-emerald-800" : "text-red-800"}`}>
                    {result.is_correct ? "Правильно!" : "Неправильно"}
                  </p>
                  {result.is_correct && <p className="text-sm text-emerald-700 mt-0.5">Отлично, так держать!</p>}
                </div>
              </div>
            </div>

            {result.is_correct && (
              <>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                  <p className="text-indigo-900 font-medium mb-2">
                    Проверьте своё решение по эталонному и оцените по критериям.
                  </p>
                  <button
                    onClick={() => setShowSolution(!showSolution)}
                    className="btn-outline"
                  >
                    {showSolution ? "Скрыть эталонное решение" : "Показать эталонное решение"}
                  </button>
                </div>

                {showSolution && (
                  <div className="bg-indigo-50/50 rounded-xl p-6 border border-indigo-200">
                    <h4 className="font-semibold mb-3">Правильное решение:</h4>
                    {result.solution_summary || result.solution_detailed || (result.solution_steps && result.solution_steps.length > 0) ? (
                      <div className="space-y-4">
                        {result.solution_summary && (
                          <div>
                            <p className="text-sm font-semibold text-slate-600 mb-1">Краткое решение:</p>
                            <p className="text-slate-700 whitespace-pre-line">{result.solution_summary}</p>
                          </div>
                        )}
                        {result.solution_detailed && (
                          <div>
                            <p className="text-sm font-semibold text-slate-600 mb-1">Развёрнутое решение:</p>
                            <p className="text-slate-700 whitespace-pre-line">{result.solution_detailed}</p>
                          </div>
                        )}
                        {result.solution_steps && result.solution_steps.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-indigo-200">
                            <p className="text-sm font-semibold text-slate-600 mb-3">По шагам:</p>
                            <div className="space-y-3">
                              {result.solution_steps.map((step, idx) => (
                                <div key={idx} className="bg-white rounded-xl p-3 border border-indigo-100">
                                  <div className="flex items-start gap-3">
                                    <div className="task-pill w-7 h-7 text-xs flex-shrink-0">
                                      {step.order}
                                    </div>
                                    <div className="flex-1">
                                      <h5 className="font-semibold text-sm">{step.step_title}</h5>
                                      {step.step_type === "text" && step.content && (
                                        <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">{step.content}</p>
                                      )}
                                      {step.step_type === "schema" && step.schema_data && (
                                        <div className="mt-2">
                                          <Suspense fallback={<div className="text-sm text-slate-500">Загрузка...</div>}>
                                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                              <SchemaEditor
                                                initialData={step.schema_data}
                                                readOnly={true}
                                                compact={true}
                                                width={700}
                                                height={400}
                                                isTeacher={false}
                                              />
                                            </div>
                                          </Suspense>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">Решение не добавлено</p>
                    )}
                  </div>
                )}
              </>
            )}

            {result.is_correct ? (
              <button
                onClick={handleNext}
                className="btn-primary btn-lg w-full"
              >
                {solvedCount >= targetTasks - 1 ? "Завершить обучение" : "Следующая задача →"}
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setResult(null);
                    setAnswer("");
                    clearAnswerPhotos();
                    setShowSolution(false);
                  }}
                  className="btn-outline btn-lg w-full"
                >
                  Попробовать снова
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 text-center">
        <p className="text-xs text-slate-400">Система подбирает сложность задач под ваш уровень</p>
      </div>

    </div>
  );
}

// ============================================================================
// STAGE: METHOD COMPOSITION
// ============================================================================

function StageMethodComposition() {
  const { ksData, session, updateSession } = useApp();
  const method = ksData.solution_method;

  const sortedSteps = useMemo(
    () => [...(method?.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [method?.steps]
  );

  // Определяем, какие шаги нужно заполнить (те, у которых hide_title_in_composition = true)
  const stepsToFill = method?.steps?.filter((step) => step.hide_title_in_composition) || [];

  /** Medium path: ordering exercise before task list. */
  const useMediumOrdering =
    session?.difficulty_choice === "medium" && sortedSteps.length >= 2 && !!method;

  const stepsSig = useMemo(
    () => sortedSteps.map((s) => String(s.order ?? "")).join(","),
    [sortedSteps]
  );

  const [studentAnswers, setStudentAnswers] = useState({}); // {stepOrder: "название действия"}
  const [checking, setChecking] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null); // {correct: [], wrong: []}

  const [orderedSteps, setOrderedSteps] = useState([]);
  const [orderResult, setOrderResult] = useState(null); // null | "wrong" | "ok"
  const [orderDragIndex, setOrderDragIndex] = useState(null);
  const [orderDropBeforeIndex, setOrderDropBeforeIndex] = useState(null);
  const [orderWrongCount, setOrderWrongCount] = useState(0);
  const [lockedOrderIndexes, setLockedOrderIndexes] = useState(new Set());

  const reorderOrderedSteps = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setOrderedSteps((prev) => {
      if (lockedOrderIndexes.has(fromIndex) || lockedOrderIndexes.has(toIndex)) return prev;
      const movableIndexes = prev.map((_, idx) => idx).filter((idx) => !lockedOrderIndexes.has(idx));
      const fromMovable = movableIndexes.indexOf(fromIndex);
      const toMovable = movableIndexes.indexOf(toIndex);
      if (fromMovable < 0 || toMovable < 0) return prev;
      const movableSteps = movableIndexes.map((idx) => prev[idx]);
      const [removed] = movableSteps.splice(fromMovable, 1);
      movableSteps.splice(toMovable, 0, removed);
      const next = [...prev];
      movableIndexes.forEach((idx, pos) => {
        next[idx] = movableSteps[pos];
      });
      return next;
    });
    setOrderResult(null);
  };

  useEffect(() => {
    if (!useMediumOrdering) return;
    const sorted = [...(method?.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (sorted.length < 2) return;
    setOrderedSteps(shuffleMethodStepsForChallenge(sorted));
    setOrderResult(null);
    setOrderWrongCount(0);
    setLockedOrderIndexes(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stepsSig синхронизирует пересбор при смене шагов
  }, [useMediumOrdering, stepsSig]);

  const moveOrderStep = (index, delta) => {
    setOrderedSteps((prev) => {
      if (lockedOrderIndexes.has(index)) return prev;
      const movableIndexes = prev.map((_, idx) => idx).filter((idx) => !lockedOrderIndexes.has(idx));
      const currentPos = movableIndexes.indexOf(index);
      const targetPos = currentPos + delta;
      if (currentPos < 0 || targetPos < 0 || targetPos >= movableIndexes.length) return prev;
      const next = [...prev];
      const targetIndex = movableIndexes[targetPos];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setOrderResult(null);
  };

  const checkOrder = () => {
    const ok = orderedSteps.length === sortedSteps.length
      && orderedSteps.every((s, i) => s.order === sortedSteps[i].order);
    setOrderResult(ok ? "ok" : "wrong");
    if (ok) {
      setOrderWrongCount(0);
      setLockedOrderIndexes(new Set());
    } else {
      const nextWrongCount = orderWrongCount + 1;
      setOrderWrongCount(nextWrongCount);
      if (nextWrongCount >= 2) {
        const locked = new Set();
        orderedSteps.forEach((step, index) => {
          if (step.order === sortedSteps[index]?.order) {
            locked.add(index);
          }
        });
        setLockedOrderIndexes(locked);
      } else {
        setLockedOrderIndexes(new Set());
      }
    }
  };

  const handleSubmit = async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/ks/${ksData.id}/check_method_composition/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({
          answers: studentAnswers // {stepOrder: "название"}
        })
      });
      const data = await res.json();
      setComparisonResult(data);
    } catch (e) {
      console.error(e);
      alert("Ошибка проверки: " + e.message);
    } finally {
      setChecking(false);
    }
  };

  const handleContinue = async () => {
    try {
      await ensureCSRFCookie();
      const res = await fetch(`/api/session/${session.id}/advance_stage/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ next_stage: "task_list" })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Не удалось перейти к следующему этапу");
      }
      await updateSession();
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card p-6 md:p-8 mb-6">
        <div className="eora-screen-header">
          {useMediumOrdering ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Расстановка шагов метода решения</h2>
              <p className="eora-screen-lead">
                Вы выбрали уровень «Непросто». Задание: выстроите шаги метода решения в логичной последовательности
                (перетаскиванием строк или кнопками «вверх» / «вниз»), затем проверьте порядок.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Составление метода решения</h2>
              <p className="eora-screen-lead">
                Восстановите недостающие названия действий в методе решения по контексту шага.
              </p>
            </>
          )}
        </div>

        {ksData.comprehension_image_url && (
          <div className="mb-8 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <h3 className="font-semibold mb-3 text-indigo-900 text-sm">Система знаний</h3>
            <img
              src={ksData.comprehension_image_url}
              alt="Система знаний"
              className="max-w-full h-auto rounded-lg border border-indigo-200"
            />
          </div>
        )}

        {method && useMediumOrdering ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 leading-snug">
              Перетащите строку за маркер <span className="font-medium">⋮⋮</span> слева: при перетаскивании
              отображается линия вставки. Кнопки «↑» и «↓» сдвигают шаг на одну позицию. Развёрнутое описание шага — в блоке
              «Подробнее».
            </p>
            <div className="rounded-lg border border-amber-200/70 bg-amber-50/20 divide-y divide-amber-100/80">
              {orderedSteps.map((step, idx) => (
                <div key={`ord-${step.order}-${idx}`}>
                  {orderDragIndex !== null && orderDropBeforeIndex === idx && (
                    <div className="h-0.5 bg-indigo-500 shadow-[0_0_6px_rgba(79,70,229,0.6)]" aria-hidden />
                  )}
                  {(() => {
                    const isLocked = lockedOrderIndexes.has(idx);
                    return (
                  <div
                    className={`group flex select-none items-stretch gap-1.5 py-0.5 pl-1 pr-1 transition-colors ${
                      isLocked
                        ? "bg-emerald-50/90"
                        : orderDragIndex === idx
                          ? "bg-amber-100/50 opacity-50"
                          : "hover:bg-white/60"
                    }`}
                    onDragOver={(e) => {
                      if (orderResult === "ok" || orderDragIndex === null || isLocked) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setOrderDropBeforeIndex(idx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (orderResult === "ok" || isLocked) return;
                      const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                      if (Number.isNaN(from)) return;
                      reorderOrderedSteps(from, idx);
                      setOrderDragIndex(null);
                      setOrderDropBeforeIndex(null);
                    }}
                  >
                    <div
                      draggable={orderResult !== "ok" && !isLocked}
                      onDragStart={(e) => {
                        if (orderResult === "ok" || isLocked) return;
                        e.dataTransfer.setData("text/plain", String(idx));
                        e.dataTransfer.effectAllowed = "move";
                        try {
                          e.dataTransfer.setDragImage(e.currentTarget, 12, 12);
                        } catch {
                          /* ignore */
                        }
                        setOrderDragIndex(idx);
                        setOrderDropBeforeIndex(null);
                      }}
                      onDragEnd={() => {
                        setOrderDragIndex(null);
                        setOrderDropBeforeIndex(null);
                      }}
                      title="Перетащить строку"
                      aria-label="Перетащить шаг"
                      className={`flex w-8 shrink-0 touch-manipulation items-center justify-center self-stretch rounded border bg-white ${
                        isLocked
                          ? "cursor-not-allowed border-emerald-200 text-emerald-500 opacity-80"
                          : `cursor-grab border-amber-200/90 text-slate-400 hover:border-amber-400 hover:text-amber-900 active:cursor-grabbing ${
                              orderResult === "ok" ? "cursor-not-allowed opacity-40" : ""
                            }`
                      }`}
                    >
                      <span className="pointer-events-none text-[11px] font-bold leading-none tracking-tighter">
                        ⋮⋮
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white ${
                        isLocked ? "bg-emerald-500" : "bg-amber-500"
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold leading-tight text-slate-900 line-clamp-2">
                          {step.title}
                        </h4>
                        {isLocked && (
                          <p className="mt-1 text-[11px] font-medium text-emerald-700">
                            Этот шаг уже стоит верно и зафиксирован.
                          </p>
                        )}
                        {step.description ? (
                          <details className="mt-0.5">
                            <summary className="cursor-pointer text-[11px] text-amber-800/90 hover:underline list-none [&::-webkit-details-marker]:hidden">
                              Подробнее
                            </summary>
                            <p className="mt-1 max-h-24 overflow-y-auto text-xs leading-snug text-slate-600 border-l-2 border-amber-200 pl-2">
                              {step.description}
                            </p>
                          </details>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col justify-center gap-0.5 pr-0.5">
                      <button
                        type="button"
                        aria-label="Выше"
                        disabled={idx === 0 || orderResult === "ok" || isLocked}
                        onClick={() => moveOrderStep(idx, -1)}
                        className="rounded border border-slate-200/80 bg-white px-1.5 py-0 text-[11px] leading-none text-slate-600 hover:bg-slate-50 disabled:opacity-25"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Ниже"
                        disabled={idx === orderedSteps.length - 1 || orderResult === "ok" || isLocked}
                        onClick={() => moveOrderStep(idx, 1)}
                        className="rounded border border-slate-200/80 bg-white px-1.5 py-0 text-[11px] leading-none text-slate-600 hover:bg-slate-50 disabled:opacity-25"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                    );
                  })()}
                </div>
              ))}
            </div>
            {orderResult === "wrong" && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-900 text-sm leading-snug">
                Порядок пока не совпадает с методом. Проверьте: что выполняют в начале анализа задачи, что — после
                введения и обозначения величин, что — ближе к получению ответа.
              </div>
            )}
            {orderResult === "ok" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 text-sm leading-snug">
                Последовательность совпадает с методом решения. Можно перейти к списку ситуаций.
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {orderResult !== "ok" && (
                <button type="button" onClick={checkOrder} className="btn-primary btn-lg">
                  Проверить порядок
                </button>
              )}
              {orderResult === "ok" && (
                <button type="button" onClick={handleContinue} className="btn-primary btn-lg">
                  К списку ситуаций
                </button>
              )}
            </div>
          </div>
        ) : method ? (
          <div className="space-y-4">
            {method.steps?.map((step, idx) => {
              const needsInput = step.hide_title_in_composition;
              const isCorrect = comparisonResult?.correct?.includes(step.order);
              const isWrong = comparisonResult?.wrong?.includes(step.order);

              return (
                <div
                  key={idx}
                  className={`flex gap-4 p-4 rounded-xl ${
                    isCorrect ? "bg-emerald-50 border-2 border-emerald-200" :
                    isWrong ? "bg-red-50 border-2 border-red-200" :
                    "bg-slate-50"
                  }`}
                >
                  <div className="task-pill flex-shrink-0">
                    {step.order}
                  </div>
                  <div className="flex-1">
                    {needsInput ? (
                      <div>
                        <input
                          type="text"
                          value={studentAnswers[step.order] || ""}
                          onChange={(e) => setStudentAnswers({
                            ...studentAnswers,
                            [step.order]: e.target.value
                          })}
                          placeholder="Введите название действия..."
                          className="input"
                        />
                        {step.description && (
                          <p className="text-sm text-slate-600 mt-2 italic">{step.description}</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-semibold">{step.title}</h4>
                        {step.description && (
                          <p className="text-sm text-slate-600 mt-1">{step.description}</p>
                        )}
                      </div>
                    )}
                    {comparisonResult && needsInput && (
                      <div className="mt-2 text-sm">
                        {isCorrect && (
                          <span className="text-emerald-700 font-medium">✓ Правильно</span>
                        )}
                        {isWrong && comparisonResult.correct_answers?.[step.order] && (
                          <div>
                            <span className="text-red-700 font-medium">✗ Неверно</span>
                            <p className="text-slate-600 mt-1">
                              Правильный вариант: <span className="font-semibold">{comparisonResult.correct_answers[step.order]}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-amber-50 rounded-xl p-6 text-center">
            <p className="text-amber-800 mb-2">Метод решения ещё не добавлен для этой системы знаний.</p>
            <p className="text-sm text-amber-700 mb-4">
              Этот шаг пропустим и сразу перейдём к примеру и задачам.
            </p>
            <button
              onClick={handleContinue}
              className="btn-primary btn-lg"
            >
              Продолжить →
            </button>
          </div>
        )}

        {!useMediumOrdering && !comparisonResult && stepsToFill.length > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={checking || Object.keys(studentAnswers).length < stepsToFill.length}
              className="btn-primary btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? "Проверка..." : "Проверить"}
            </button>
          </div>
        )}

        {!useMediumOrdering && !comparisonResult && stepsToFill.length === 0 && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleContinue}
              className="btn-primary btn-lg"
            >
              Продолжить →
            </button>
          </div>
        )}

        {!useMediumOrdering && comparisonResult && (
          <div className="mt-6">
            <div className="bg-indigo-50 rounded-xl p-4 mb-4 border border-indigo-100">
              <p className="text-indigo-900 font-medium">
                Сравните свой вариант с правильным методом решения.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleContinue}
                className="btn-primary btn-lg"
              >
                Продолжить →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STAGE: STEP BY STEP
// ============================================================================

function StageStepByStep() {
  const { ksData, session, updateSession } = useApp();
  const [taskData, setTaskData] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [textSelections, setTextSelections] = useState({});
  const [symbolDrafts, setSymbolDrafts] = useState({}); // {stepOrder: { fragment, symbol }}
  const [stepAttempts, setStepAttempts] = useState({});
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showIntroModal, setShowIntroModal] = useState(true);
  // Для шага со схемой
  const [schemaStudentSnapshot, setSchemaStudentSnapshot] = useState(null);
  const [showSchemaCompareModal, setShowSchemaCompareModal] = useState(false);
  const [showMySchema, setShowMySchema] = useState(false);
  const [solutionParts, setSolutionParts] = useState({});
  const [symbolEntries, setSymbolEntries] = useState({});
  const [showFullSymbolPalette, setShowFullSymbolPalette] = useState(false);

  useEffect(() => {
    const storedTaskId = window.localStorage.getItem(STEP_BY_STEP_TASK_KEY);
    if (storedTaskId) {
      loadTaskStepByStep(parseInt(storedTaskId, 10));
      return;
    }

    if (!session?.id) return;

    (async () => {
      try {
        const res = await fetch(`/api/session/${session.id}/next_task/`);
        if (!res.ok) throw new Error("next_task failed");
        const data = await res.json();
        if (data.task?.id) {
          window.localStorage.setItem(STEP_BY_STEP_TASK_KEY, String(data.task.id));
          loadTaskStepByStep(data.task.id);
        } else {
          const tasks = ksData?.tasks || [];
          if (tasks.length > 0) {
            loadTaskStepByStep(tasks[0].id);
          } else {
            setError("Нет доступных задач для пооперационного контроля");
            setLoading(false);
          }
        }
      } catch {
        const tasks = ksData?.tasks || [];
        if (tasks.length > 0) {
          loadTaskStepByStep(tasks[0].id);
        } else {
          setError("Нет доступных задач для пооперационного контроля");
          setLoading(false);
        }
      }
    })();
  }, [ksData, session?.id]);

  const loadTaskStepByStep = async (taskId) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/task/${taskId}/step_by_step/`);
      if (!res.ok) throw new Error("Не удалось загрузить задачу");
      const data = await res.json();
      setTaskData(data);
      setCurrentStepIndex(0);
      setStudentAnswers({});
      setTextSelections({});
      setStepAttempts({});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStep = async (stepOrder, overrideAnswer = null) => {
    const studentAnswer = overrideAnswer !== null
      ? overrideAnswer
      : (studentAnswers[stepOrder] || "");
    if (!studentAnswer.trim()) {
      alert("Введите ответ на этот шаг");
      return;
    }

    setChecking(true);
    try {
      await ensureCSRFCookie();
      const res = await fetch(`/api/task/${taskData.task.id}/check_step/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({
          session_id: session.id,
          step_order: stepOrder,
          student_answer: studentAnswer
        })
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const raw = await res.text();
        throw new Error(
          `Сервер вернул не JSON (HTTP ${res.status}). Возможно, сессия истекла или вы не авторизованы. Детали: ${raw.slice(0, 120)}...`
        );
      }

      const data = await res.json();
      
      setStepAttempts({
        ...stepAttempts,
        [stepOrder]: {
          step_attempt_id: data.step_attempt_id,
          is_correct: data.is_correct,
          needs_choice: data.needs_choice,
          reference_answer: data.reference_answer,
          reference_image_url: data.reference_image_url,
          final_answer: data.final_answer || null,
          chose_system_variant: false,
        }
      });
    } catch (e) {
      alert("Ошибка проверки: " + e.message);
    } finally {
      setChecking(false);
    }
  };

  const handleChooseVariant = async (stepOrder, choseSystemVariant) => {
    const attempt = stepAttempts[stepOrder];
    if (!attempt?.step_attempt_id) return;

    try {
      const res = await fetch(`/api/task/${taskData.task.id}/choose_step_variant/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({
          step_attempt_id: attempt.step_attempt_id,
          chose_system_variant: choseSystemVariant
        })
      });
      const data = await res.json();
      
      // Обновляем состояние
      setStepAttempts({
        ...stepAttempts,
        [stepOrder]: {
          ...attempt,
          chose_system_variant: choseSystemVariant,
          final_answer: data.final_answer,
        }
      });

      // Переход к следующему шагу
      if (currentStepIndex < activeSteps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    } catch (e) {
      alert("Ошибка: " + e.message);
    }
  };

  const handleNextStep = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentStepIndex < activeSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleTextPickToggle = (stepOrder, tokenIndex, tokens) => {
    const current = textSelections[stepOrder] || [];
    const next = current.includes(tokenIndex)
      ? current.filter((idx) => idx !== tokenIndex)
      : [...current, tokenIndex].sort((a, b) => a - b);

    setTextSelections({
      ...textSelections,
      [stepOrder]: next,
    });

    const selectedText = next
      .map((idx) => tokens[idx]?.clean || "")
      .filter(Boolean)
      .join(" ")
      .trim();

    setStudentAnswers({
      ...studentAnswers,
      [stepOrder]: selectedText,
    });
  };

  const handleSymbolRangeSelect = (stepOrder, tokenId, tokens) => {
    const current = textSelections[stepOrder] || [];
    let newRange;

    if (current.length === 0) {
      newRange = [tokenId];
    } else if (current.length === 1 && current[0] === tokenId) {
      newRange = [];
    } else {
      const min = Math.min(...current, tokenId);
      const max = Math.max(...current, tokenId);
      newRange = [];
      for (let i = min; i <= max; i++) newRange.push(i);
    }

    setTextSelections({ ...textSelections, [stepOrder]: newRange });

    const fragment = newRange
      .sort((a, b) => a - b)
      .map((idx) => tokens[idx])
      .filter((t) => t && !t.isSpace)
      .map((t) => t.text)
      .join(" ")
      .trim();

    setSymbolDrafts({
      ...symbolDrafts,
      [stepOrder]: {
        ...(symbolDrafts[stepOrder] || {}),
        fragment,
      },
    });
  };

  const handleComplete = async () => {
    // Record successful step-by-step completion for scaffolding
    try {
      await fetch(`/api/session/${session.id}/complete_step_by_step/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFCookie() },
      });
    } catch (e) { console.debug("step_by_step completion tracking:", e); }

    const storedTaskId = window.localStorage.getItem(STEP_BY_STEP_TASK_KEY);

    if (storedTaskId && taskData?.task?.id) {
      await fetch(`/api/task/${taskData.task.id}/complete_guided/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ session_id: session.id })
      });

      window.localStorage.removeItem(STEP_BY_STEP_TASK_KEY);

      await fetch(`/api/session/${session.id}/advance_stage/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({ next_stage: "task_list" })
      });
      await updateSession();
      return;
    }

    await fetch(`/api/session/${session.id}/advance_stage/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCSRFCookie()
      },
      body: JSON.stringify({ next_stage: "task_list" })
    });
    await updateSession();
  };

  // Gradual scaffolding: after 2+ completions, show only key steps
  const completions = session?.step_by_step_completions || 0;
  const isScaffolded = completions >= 2 && taskData?.steps?.length > 2;
  const activeSteps = useMemo(() => {
    if (!taskData?.steps) return [];
    if (!isScaffolded) return taskData.steps;
    return taskData.steps.filter((s) => KEY_STEP_ORDERS.includes(s.order));
  }, [taskData?.steps, isScaffolded]);

  // Проверяем, все ли активные шаги завершены
  const allStepsCompleted = activeSteps.every(step => {
    const stepAttempt = stepAttempts[step.order];
    return !!stepAttempt?.final_answer;
  }) || false;

  const hasCompletedSchemaSteps = taskData?.steps?.some(
    (s) => s.step_type === "schema" && stepAttempts[s.order]?.final_answer
  ) || false;

  const symbolStepOrder = taskData?.steps?.find((s) => s.step_type === "symbol")?.order;
  const studentFoundQuantities = symbolEntries[symbolStepOrder] || [];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-600">Загрузка задачи...</p>
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <div className="text-red-600 mb-4">{error || "Задача не найдена"}</div>
          <button onClick={() => handleComplete()} className="btn-primary">
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  const currentStep = activeSteps[currentStepIndex] || taskData.steps[0];
  const currentStepOrder = currentStep.order;
  const attempt = stepAttempts[currentStepOrder];
  const selectableTokens = tokenizeSelectableText(taskData.task.text);
  const isBooleanStep = currentStep.step_type === "boolean";
  const isSymbolStep = currentStep.step_type === "symbol";

  return (
    <>
      {showIntroModal && (
        <FullScreenModal>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8">
            <div className="eora-screen-header mb-5">
              <h3 className="text-xl font-bold text-slate-900">Разберём задачу по шагам</h3>
              <p className="eora-screen-lead text-sm mt-2">
                Решение представлено по шагам: на каждом шаге сформулируйте ответ, сравните его с эталоном и отметьте
                выбранный вариант.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 mb-6">
              <div className="font-semibold text-slate-800 mb-2">Как это работает:</div>
              <ol className="space-y-1.5 list-decimal list-inside text-slate-600">
                <li>Прочитайте условие задачи и текущий шаг</li>
                <li>Дайте свой ответ на шаг</li>
                <li>Сравните с эталоном и выберите вариант</li>
                <li>Переходите к следующему шагу</li>
              </ol>
            </div>
            <button
              onClick={() => setShowIntroModal(false)}
              className="btn-primary btn-lg w-full"
            >
              Начать разбор
            </button>
          </div>
        </FullScreenModal>
      )}

      <div className="max-w-7xl mx-auto px-2">
        {/* Scaffolding notice */}
        {isScaffolded && (
          <div className="card px-5 py-3 mb-4 bg-indigo-50 border-indigo-200 text-indigo-800 text-sm">
            Ты уже знаком с методом — попробуй выполнить основные шаги сам.
          </div>
        )}

        {/* Progress strip */}
        <div className="card px-5 py-3 mb-4 flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-700">
            Шаг {currentStepIndex + 1} из {activeSteps.length}
          </span>
          <div className="flex-1 progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${Math.min(100, (activeSteps.filter(s => stepAttempts[s.order]?.final_answer).length / Math.max(1, activeSteps.length)) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">
            {activeSteps.filter(s => stepAttempts[s.order]?.final_answer).length} из {activeSteps.length}
          </span>
        </div>

        {/* Clickable step navigation circles */}
        <div className="card px-5 py-3 mb-4">
          <div className="flex gap-2 justify-center flex-wrap">
            {activeSteps.map((step, idx) => {
              const isCurrent = idx === currentStepIndex;
              const attemptForStep = stepAttempts[step.order];
              const isCompleted = !!attemptForStep?.final_answer;
              const stepErrCount = (session?.step_error_history || {})[String(step.order)] || 0;
              const hasWarning = stepErrCount > 0 && !isCompleted;
              return (
                <div key={step.order} className="relative">
                  <button
                    type="button"
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-indigo-600 text-white ring-2 ring-indigo-300 shadow-md scale-110"
                        : isCompleted
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : hasWarning
                            ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300 hover:bg-amber-200"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                    title={`Шаг ${step.order}: ${step.title}${hasWarning ? ` (ошибок ранее: ${stepErrCount})` : ""}`}
                  >
                    {isCompleted && !isCurrent ? "✓" : step.order}
                  </button>
                  {hasWarning && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">!</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== TWO-COLUMN LAYOUT ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* LEFT COLUMN — Task condition + Schema drawer (sticky) */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-4 space-y-4">
              <div className="card p-5">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-4">
                  <p className="text-indigo-900 text-xs font-medium">{DEFAULT_TASK_FORMULATION}</p>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="task-pill">{taskData.task.order || "?"}</span>
                  <h3 className="text-lg font-bold tracking-tight">Условие задачи</h3>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-slate-800 leading-relaxed" style={{ fontSize: "1.05rem" }}>{taskData.task.text}</p>
                </div>
                {taskData.method?.title && (
                  <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-indigo-800 flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">📋</span>
                    <span className="font-semibold">{taskData.method.title}</span>
                  </div>
                )}
              </div>

              {/* Schema drawer — only shows STUDENT schema */}
              {hasCompletedSchemaSteps && (
                <div className="card overflow-hidden">
                  <button
                    onClick={() => setShowMySchema(!showMySchema)}
                    className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📐</span>
                      <span className="font-semibold text-purple-900 text-sm">Моя схема</span>
                    </div>
                    <svg
                      className={`w-5 h-5 text-purple-400 transition-transform ${showMySchema ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showMySchema && (
                    <div className="p-3 border-t border-purple-100">
                      {schemaStudentSnapshot?.elements?.length > 0 ? (
                        <Suspense fallback={<div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
                          <SchemaEditor
                            key={`my-schema-${schemaStudentSnapshot.elements.length}`}
                            initialData={schemaStudentSnapshot}
                            readOnly={true}
                            compact={true}
                            width={450}
                            height={280}
                            isTeacher={false}
                          />
                        </Suspense>
                      ) : (
                        <div className="text-center py-6 text-slate-400 text-sm">
                          Схема ещё не сохранена. Постройте её на шагах 2–4.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — Step content */}
          <div className="lg:col-span-7">
          <div className="card p-6">
          {/* Current step header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0">
              {currentStepOrder}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{currentStep.title}</h3>
              {currentStep.description && (
                <p className="text-sm text-slate-600 mt-1">{currentStep.description}</p>
              )}
            </div>
          </div>

          {/* Per-step error history hint */}
          {(() => {
            const errCount = (session?.step_error_history || {})[String(currentStepOrder)] || 0;
            if (errCount <= 0 || attempt?.final_answer) return null;
            return (
              <div className={`rounded-lg p-3 mb-4 text-sm ${errCount >= 2 ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-blue-50 border border-blue-200 text-blue-800"}`}>
                {errCount >= 2
                  ? "На этом шаге вы ошибались ранее. Внимательно перечитайте условие и проверьте свои рассуждения."
                  : "В прошлый раз здесь была ошибка — сейчас проверь этот шаг особенно внимательно."}
              </div>
            );
          })()}

        {/* Поле для ввода / выбора ответа */}
        {!attempt?.final_answer && (
          <div className="mb-6">
            {/* text_pick — выбор слов из текста */}
            {currentStep.step_type === "text_pick" && (
              <>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Выберите ответ прямо из текста задачи:
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="leading-8 text-slate-800">
                    {selectableTokens.map((token) => {
                      if (token.isSpace) return <span key={token.id}>{token.text}</span>;
                      const isSelected = (textSelections[currentStepOrder] || []).includes(token.id);
                      return (
                        <button
                          key={token.id}
                          type="button"
                          onClick={() => handleTextPickToggle(currentStepOrder, token.id, selectableTokens)}
                          className={`mx-[2px] inline rounded px-1 py-0.5 transition-colors ${isSelected ? "bg-blue-600 text-white" : "hover:bg-blue-100"}`}
                        >
                          {token.text}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-sm text-slate-600">
                    Ваш выбор:{" "}
                    <span className="font-medium text-slate-900">
                      {studentAnswers[currentStepOrder] || "пока ничего не выбрано"}
                    </span>
                  </div>
                </div>
                {currentStep.hint && (
                  <p className="text-xs text-slate-500 mt-2 italic">💡 {currentStep.hint}</p>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleCheckStep(currentStepOrder)}
                    disabled={checking || !studentAnswers[currentStepOrder]?.trim()}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checking ? "Проверка..." : "Проверить"}
                  </button>
                </div>
              </>
            )}

            {/* boolean — ответ да/нет */}
            {currentStep.step_type === "boolean" && (
              <>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Выберите ответ:
                </label>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() =>
                      setStudentAnswers({
                        ...studentAnswers,
                        [currentStepOrder]: "yes",
                      })
                    }
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      studentAnswers[currentStepOrder] === "yes"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-slate-800 border-slate-300 hover:bg-emerald-50"
                    }`}
                  >
                    Да
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStudentAnswers({
                        ...studentAnswers,
                        [currentStepOrder]: "no",
                      })
                    }
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      studentAnswers[currentStepOrder] === "no"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-white text-slate-800 border-slate-300 hover:bg-rose-50"
                    }`}
                  >
                    Нет
                  </button>
                </div>
                {currentStep.hint && (
                  <p className="text-xs text-slate-500 mt-1 italic">💡 {currentStep.hint}</p>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleCheckStep(currentStepOrder)}
                    disabled={checking || !studentAnswers[currentStepOrder]}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checking ? "Проверка..." : "Проверить"}
                  </button>
                </div>
              </>
            )}

            {/* schema — ученик работает со схемой задачи (как в основном решении) */}
            {currentStep.step_type === "schema" && (
              <div className="space-y-4">
                <div className="text-sm text-slate-700">
                  На этом шаге построй свою схему ситуации. Когда закончишь, нажми кнопку ниже — система покажет эталонную
                  схему для сравнения, и ты сможешь выбрать: перейти дальше или доработать свою схему.
                </div>

                {/* Схема ученика (живой редактор, сохраняется в сессию) */}
                <SchemaEditorSection
                  taskId={taskData.task.id}
                  sessionId={session?.id}
                  onSchemaSaved={setSchemaStudentSnapshot}
                />

                {currentStep.hint && (
                  <p className="text-xs text-slate-500 mt-1 italic">💡 {currentStep.hint}</p>
                )}

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      // Сначала показываем сравнение схем в модальном окне
                      setShowSchemaCompareModal(true);
                    }}
                    className="btn-primary"
                  >
                    Сравнить с эталоном →
                  </button>
                </div>
              </div>
            )}

            {/* symbol — интерактивный конструктор «Дано / Найти» */}
            {currentStep.step_type === "symbol" && (() => {
              const entries = symbolEntries[currentStepOrder] || [];
              const givenEntries = entries.filter((e) => !e.isTarget);
              const targetEntry = entries.find((e) => e.isTarget);
              const draft = symbolDrafts[currentStepOrder] || {};
              const selectedRange = textSelections[currentStepOrder] || [];

              const BASIC = ["S", "v", "t", "a", "m", "F", "N", "L", "d"];
              const SUBS = ["₁", "₂", "₃", "₀"];
              const FULL_GROUPS = [
                { group: "Основные", items: ["S", "v", "t", "a", "m", "F", "N", "L", "d", "P", "E", "W", "g", "h", "R", "p"] },
                { group: "С индексами", items: ["v₁", "v₂", "S₁", "S₂", "t₁", "t₂", "v₀", "S₀", "a₁", "a₂", "t₀"] },
                { group: "Специальные", items: ["Δ", "ΔS", "Δt", "Δv", "ω", "ρ", "μ", "π", "v_ср", "v_теч", "v_плав", "v_бег", "v_пл", "v_ваг", "v_п"] },
              ];

              const setDraft = (patch) =>
                setSymbolDrafts((prev) => ({
                  ...prev,
                  [currentStepOrder]: { ...(prev[currentStepOrder] || {}), ...patch },
                }));

              const clearSelection = () => {
                setTextSelections({ ...textSelections, [currentStepOrder]: [] });
                setDraft({ fragment: "" });
              };

              const addEntry = (isTarget) => {
                const fragment = (draft.fragment || "").trim();
                const symbol = (draft.symbol || "").trim();
                if (!fragment || !symbol) return;
                const updated = [...entries];
                if (isTarget) {
                  const idx = updated.findIndex((e) => e.isTarget);
                  if (idx >= 0) updated.splice(idx, 1);
                }
                updated.push({ fragment, symbol, isTarget });
                setSymbolEntries({ ...symbolEntries, [currentStepOrder]: updated });
                setTextSelections({ ...textSelections, [currentStepOrder]: [] });
                setSymbolDrafts({ ...symbolDrafts, [currentStepOrder]: {} });
                setShowFullSymbolPalette(false);
              };

              const removeEntry = (idx) => {
                const updated = [...entries];
                updated.splice(idx, 1);
                setSymbolEntries({ ...symbolEntries, [currentStepOrder]: updated });
              };

              const hasDraft = !!(draft.fragment || draft.symbol);

              return (
                <div className="space-y-5">
                  {/* Instruction */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                    <h4 className="text-sm font-bold text-indigo-800 mb-1">Составьте краткую запись условия</h4>
                    <p className="text-xs text-indigo-600 leading-relaxed">
                      Выделите величину в тексте, назначьте ей обозначение, затем добавьте в «Дано» или «Найти». Повторите для всех величин.
                    </p>
                  </div>

                  {/* 1. Text selection */}
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      1. Выделите величину в тексте задачи
                      <span className="text-xs text-slate-400 ml-1">(нажмите на первое и последнее слово)</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="leading-8 text-slate-800 text-sm">
                        {selectableTokens.map((token) => {
                          if (token.isSpace) return <span key={token.id}>{token.text}</span>;
                          const isInRange = selectedRange.includes(token.id);
                          return (
                            <button
                              key={token.id}
                              type="button"
                              onClick={() => handleSymbolRangeSelect(currentStepOrder, token.id, selectableTokens)}
                              className={`mx-[1px] inline rounded px-1 py-0.5 transition-colors ${
                                isInRange ? "bg-amber-500 text-white font-medium" : "hover:bg-amber-100"
                              }`}
                            >
                              {token.text}
                            </button>
                          );
                        })}
                      </div>
                      {draft.fragment && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-sm text-slate-600">
                            Выделено: <span className="font-semibold text-amber-800">{draft.fragment}</span>
                          </span>
                          <button type="button" onClick={clearSelection}
                            className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50">
                            ✕ Очистить
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Symbol picker */}
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">2. Назначьте обозначение</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={draft.symbol || ""}
                        onChange={(e) => setDraft({ symbol: e.target.value })}
                        className="w-24 px-3 py-2 border border-slate-300 rounded-lg font-mono text-lg focus:ring-2 focus:ring-indigo-400"
                        placeholder="v₁"
                      />
                      {BASIC.map((sym) => (
                        <button key={sym} type="button"
                          onClick={() => setDraft({ symbol: (draft.symbol || "") + sym })}
                          className="px-2.5 py-1.5 text-sm rounded-lg border bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 font-mono">
                          {sym}
                        </button>
                      ))}
                      {SUBS.map((sub) => (
                        <button key={sub} type="button"
                          onClick={() => setDraft({ symbol: (draft.symbol || "") + sub })}
                          className="px-2 py-1.5 text-sm rounded-lg border bg-slate-50 text-slate-500 border-slate-200 hover:bg-indigo-50 font-mono">
                          {sub}
                        </button>
                      ))}
                      <div className="relative">
                        <button type="button"
                          onClick={() => setShowFullSymbolPalette(!showFullSymbolPalette)}
                          className="px-3 py-1.5 text-sm rounded-lg border bg-slate-100 text-slate-600 border-slate-200 hover:bg-indigo-100 font-semibold">
                          ...
                        </button>
                        {showFullSymbolPalette && (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-72 max-h-64 overflow-y-auto">
                            {FULL_GROUPS.map((g) => (
                              <div key={g.group} className="mb-3 last:mb-0">
                                <div className="text-xs font-semibold text-slate-500 mb-1">{g.group}</div>
                                <div className="flex flex-wrap gap-1">
                                  {g.items.map((sym) => (
                                    <button key={sym} type="button"
                                      onClick={() => { setDraft({ symbol: sym }); setShowFullSymbolPalette(false); }}
                                      className="px-2 py-1 text-sm rounded border bg-white text-slate-700 border-slate-200 hover:bg-indigo-100 font-mono">
                                      {sym}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {draft.symbol && (
                        <button type="button" onClick={() => setDraft({ symbol: "" })}
                          className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">✕</button>
                      )}
                    </div>
                  </div>

                  {/* 3. Add buttons — appear when both fragment and symbol are set */}
                  {hasDraft && (
                    <div className="flex gap-3 animate-in fade-in">
                      <button type="button" onClick={() => addEntry(false)}
                        disabled={!draft.fragment || !draft.symbol}
                        className="flex-1 px-4 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium transition-colors disabled:opacity-40">
                        + Добавить в Дано
                      </button>
                      <button type="button" onClick={() => addEntry(true)}
                        disabled={!draft.fragment || !draft.symbol}
                        className="flex-1 px-4 py-2.5 rounded-xl border-2 border-dashed border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium transition-colors disabled:opacity-40">
                        + Это искомое (Найти)
                      </button>
                    </div>
                  )}

                  {/* 4. Built table */}
                  {entries.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-bold text-slate-800 mb-3">Ваша краткая запись:</div>
                      {givenEntries.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-emerald-600 mb-1.5 uppercase tracking-wide">Дано:</div>
                          <div className="space-y-1.5">
                            {givenEntries.map((e, i) => (
                              <div key={i} className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100 group">
                                <span className="font-mono font-semibold text-emerald-700 min-w-[50px]">{e.symbol}</span>
                                <span className="text-slate-400">=</span>
                                <span className="text-slate-700 flex-1 text-sm">{e.fragment}</span>
                                <button type="button" onClick={() => removeEntry(entries.indexOf(e))}
                                  className="text-slate-300 hover:text-red-500 text-lg leading-none opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {targetEntry && (
                        <div>
                          <div className="text-xs font-semibold text-amber-600 mb-1.5 uppercase tracking-wide">Найти:</div>
                          <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 group">
                            <span className="font-mono font-semibold text-amber-700 min-w-[50px]">{targetEntry.symbol}</span>
                            <span className="text-slate-400">— ?</span>
                            <span className="text-slate-700 flex-1 text-sm">{targetEntry.fragment}</span>
                            <button type="button" onClick={() => removeEntry(entries.indexOf(targetEntry))}
                              className="text-slate-300 hover:text-red-500 text-lg leading-none opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep.hint && (
                    <p className="text-xs text-slate-500 italic">💡 {currentStep.hint}</p>
                  )}

                  {/* Check button */}
                  <div className="flex justify-end">
                    <button type="button"
                      onClick={() => {
                        if (!targetEntry) {
                          alert("Укажите, что нужно найти — добавьте хотя бы одну величину как «Найти»");
                          return;
                        }
                        if (givenEntries.length === 0) {
                          alert("Добавьте хотя бы одну величину в «Дано»");
                          return;
                        }
                        const payload = JSON.stringify({ fragment: targetEntry.fragment, symbol: targetEntry.symbol });
                        setStudentAnswers({ ...studentAnswers, [currentStepOrder]: payload });
                        handleCheckStep(currentStepOrder, payload);
                      }}
                      disabled={checking || entries.length === 0 || !targetEntry}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                      {checking ? "Проверка..." : `Проверить краткую запись`}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* solution — структурированное решение (формула → СИ → расчёт → оценка) */}
            {currentStep.step_type === "solution" && (() => {
              const parts = solutionParts[currentStepOrder] || {};
              const givenItems = studentFoundQuantities.filter((it) => !it.isTarget);
              const mathSymbols = ["=", "+", "−", "·", "/", "(", ")", "²", "₁", "₂", "π", "√", "≈"];

              const insertInto = (field, text) => {
                setSolutionParts((prev) => ({
                  ...prev,
                  [currentStepOrder]: {
                    ...(prev[currentStepOrder] || {}),
                    [field]: ((prev[currentStepOrder] || {})[field] || "") + text,
                  },
                }));
              };

              const MathPalette = ({ field }) => (
                <div className="flex flex-wrap gap-1 mb-2">
                  {mathSymbols.map((s) => (
                    <button key={s} type="button" onClick={() => insertInto(field, s)}
                      className="px-2 py-1 text-xs bg-slate-100 hover:bg-indigo-100 rounded border border-slate-200 font-mono">
                      {s}
                    </button>
                  ))}
                  {studentFoundQuantities.map((it, i) => (
                    <button key={`s${i}`} type="button" onClick={() => insertInto(field, it.symbol)}
                      className="px-2 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 font-mono text-indigo-700">
                      {it.symbol}
                    </button>
                  ))}
                </div>
              );

              return (
                <div className="space-y-4">
                  {/* Previously found quantities */}
                  {givenItems.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                      <div className="text-xs font-semibold text-emerald-700 mb-2">Ваши найденные величины (из шага «Дано»)</div>
                      <div className="flex flex-wrap gap-2">
                        {givenItems.map((item, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-100 text-sm">
                            <span className="font-mono font-semibold text-emerald-700">{item.symbol}</span>
                            <span className="text-slate-400">=</span>
                            <span className="text-slate-600">{item.fragment}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 1. Formula */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">1. Формула</label>
                    <MathPalette field="formula" />
                    <textarea
                      value={parts.formula || ""}
                      onChange={(e) => setSolutionParts((p) => ({ ...p, [currentStepOrder]: { ...p[currentStepOrder], formula: e.target.value } }))}
                      placeholder="Например: S₁ = v₁ · t"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm min-h-[60px] focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>

                  {/* 2. SI conversion */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">2. Перевод в СИ (если нужно)</label>
                    <MathPalette field="si" />
                    <textarea
                      value={parts.si || ""}
                      onChange={(e) => setSolutionParts((p) => ({ ...p, [currentStepOrder]: { ...p[currentStepOrder], si: e.target.value } }))}
                      placeholder="Например: v₁ = 36 км/ч = 10 м/с"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm min-h-[60px] focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>

                  {/* 3. Calculation */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">3. Расчёт</label>
                    <MathPalette field="calc" />
                    <textarea
                      value={parts.calc || ""}
                      onChange={(e) => setSolutionParts((p) => ({ ...p, [currentStepOrder]: { ...p[currentStepOrder], calc: e.target.value } }))}
                      placeholder="Подставьте значения и вычислите..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm min-h-[80px] focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>

                  {/* 4. Reasoning */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <label className="block text-sm font-semibold text-blue-800 mb-1">4. Оценка достоверности</label>
                    <p className="text-xs text-blue-600 mb-2">Реалистичен ли полученный ответ?</p>
                    <textarea
                      value={parts.reasoning || ""}
                      onChange={(e) => setSolutionParts((p) => ({ ...p, [currentStepOrder]: { ...p[currentStepOrder], reasoning: e.target.value } }))}
                      placeholder="Например: 8 км/с — типичная скорость спутника..."
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm min-h-[50px] focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const combined = [
                          parts.formula && `Формула: ${parts.formula}`,
                          parts.si && `СИ: ${parts.si}`,
                          parts.calc && `Расчёт: ${parts.calc}`,
                          parts.reasoning && `Оценка: ${parts.reasoning}`,
                        ].filter(Boolean).join("\n");
                        if (!combined.trim()) { alert("Заполните хотя бы формулу и расчёт"); return; }
                        setStudentAnswers({ ...studentAnswers, [currentStepOrder]: combined });
                        handleCheckStep(currentStepOrder, combined);
                      }}
                      disabled={checking}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checking ? "Проверка..." : "Проверить решение"}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* text — текстовый ответ с палитрой формул */}
            {(currentStep.step_type === "text" || !currentStep.step_type) && (
              <>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Выполните это действие и запишите результат:
                </label>
                {/* Formula palette */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {["=", "+", "−", "·", "/", "(", ")", "²", "₁", "₂", "≈"].map((s) => (
                    <button key={s} type="button"
                      onClick={() => setStudentAnswers({ ...studentAnswers, [currentStepOrder]: (studentAnswers[currentStepOrder] || "") + s })}
                      className="px-2 py-1 text-xs bg-slate-100 hover:bg-indigo-100 rounded border border-slate-200 font-mono">
                      {s}
                    </button>
                  ))}
                  {studentFoundQuantities.map((it, i) => (
                    <button key={`si${i}`} type="button"
                      onClick={() => setStudentAnswers({ ...studentAnswers, [currentStepOrder]: (studentAnswers[currentStepOrder] || "") + it.symbol })}
                      className="px-2 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 font-mono text-indigo-700">
                      {it.symbol}
                    </button>
                  ))}
                </div>
                <textarea
                  value={studentAnswers[currentStepOrder] || ""}
                  onChange={(e) => setStudentAnswers({ ...studentAnswers, [currentStepOrder]: e.target.value })}
                  placeholder="Введите результат выполнения этого шага..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 min-h-[100px] font-mono"
                  disabled={checking}
                />
                {currentStep.hint && (
                  <p className="text-xs text-slate-500 mt-2 italic">💡 {currentStep.hint}</p>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleCheckStep(currentStepOrder)}
                    disabled={checking || !studentAnswers[currentStepOrder]?.trim()}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checking ? "Проверка..." : "Проверить"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

          {/* Результат проверки — сравнение с эталоном */}
          {attempt && !attempt.final_answer && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 mb-5">
              <h4 className="font-semibold text-slate-900 mb-3">Сравните варианты:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                  <div className="text-sm font-semibold text-blue-700 mb-2">Ваш ответ</div>
                  <div className="text-sm text-slate-700 whitespace-pre-line">
                    {isBooleanStep
                      ? (studentAnswers[currentStepOrder] === "yes"
                          ? "Да"
                          : studentAnswers[currentStepOrder] === "no"
                            ? "Нет"
                            : "(пусто)")
                      : isSymbolStep
                        ? (() => {
                            try {
                              const d = JSON.parse(studentAnswers[currentStepOrder] || "{}");
                              return d.symbol && d.fragment
                                ? `${d.symbol} — ${d.fragment}`
                                : "(пусто)";
                            } catch { return studentAnswers[currentStepOrder] || "(пусто)"; }
                          })()
                        : (studentAnswers[currentStepOrder] || "(пусто)")}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-sm">
                  <div className="text-sm font-semibold text-emerald-700 mb-2">Эталонный ответ</div>
                  <div className="text-sm text-slate-700 whitespace-pre-line">
                    {attempt.reference_answer}
                  </div>
                  {attempt.reference_image_url && (
                    <img src={attempt.reference_image_url} alt="Эталон" className="mt-3 max-w-full rounded-lg" />
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-4 mb-3">Какой вариант вы принимаете?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleChooseVariant(currentStepOrder, false)}
                  className="btn-secondary flex-1"
                >
                  Оставить мой
                </button>
                <button
                  onClick={() => handleChooseVariant(currentStepOrder, true)}
                  className="btn-primary flex-1"
                >
                  Принять эталон
                </button>
              </div>
            </div>
          )}

          {/* Финальный ответ (после проверки или выбора) */}
          {attempt?.final_answer && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 mb-5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">✓</div>
              <div>
                <div className="text-sm font-semibold text-emerald-800 mb-1">
                  {attempt.is_correct && !attempt.needs_choice
                    ? "Верно!"
                    : attempt.chose_system_variant
                      ? "Принят эталонный вариант"
                      : "Принят ваш вариант"}
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-line">
                  {attempt.final_answer}
                </div>
              </div>
            </div>
          )}

          {/* Навигация */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-200">
            <button
              onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Назад
            </button>
            <div className="flex gap-3">
              {import.meta.env.DEV && !attempt?.final_answer && (
                <button
                  type="button"
                  onClick={() => {
                    setStepAttempts(prev => ({
                      ...prev,
                      [currentStepOrder]: {
                        step_attempt_id: null,
                        is_correct: true,
                        needs_choice: false,
                        reference_answer: "(пропущено)",
                        final_answer: "(шаг пропущен)",
                        chose_system_variant: false,
                      },
                    }));
                    if (currentStepIndex < activeSteps.length - 1) {
                      setCurrentStepIndex(currentStepIndex + 1);
                    }
                  }}
                  className="px-4 py-2 text-sm rounded-lg border border-dashed border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                >
                  Пропустить шаг (только в dev)
                </button>
              )}
              {attempt?.final_answer && currentStepIndex < activeSteps.length - 1 && (
                <button onClick={handleNextStep} className="btn-primary">
                  Следующий шаг →
                </button>
              )}
              {(allStepsCompleted || (currentStepIndex === activeSteps.length - 1 && attempt?.final_answer)) && (
                <button onClick={handleComplete} className="btn-primary btn-lg">
                  Закончить разбор →
                </button>
              )}
            </div>
          </div>
          </div>
          </div>
        </div>
      </div>

      {/* Модальное сравнение схем для шага со схемой */}
      {showSchemaCompareModal && currentStep.step_type === "schema" && (
        <FullScreenModal>
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Сравните схему с эталоном</h3>
              <p className="text-sm text-slate-600">
                Слева — схема, которую вы построили. Справа — эталонная схема учителя. Если схемы передают одну и ту же
                ситуацию, можете перейти к следующему шагу. Если нет — вернитесь и поправьте свою схему.
              </p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-2">Ваша схема</div>
                <div className="border border-slate-200 rounded-xl bg-slate-50 p-3">
                  {schemaStudentSnapshot && schemaStudentSnapshot.elements && schemaStudentSnapshot.elements.length > 0 ? (
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      }
                    >
                      <SchemaEditor
                        key={`student-${schemaStudentSnapshot.elements.length}`}
                        initialData={schemaStudentSnapshot}
                        readOnly={true}
                        compact={true}
                        width={700}
                        height={400}
                        isTeacher={false}
                      />
                    </Suspense>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                      Вы ещё не сохранили свою схему. Нажмите «Сохранить» в редакторе схемы.
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-2">Эталонная схема учителя</div>
                <div className="border border-slate-200 rounded-xl bg-slate-50 p-3">
                  {currentStep.reference_solution?.schema_data?.elements?.length > 0 ? (
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-64">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      }
                    >
                      <SchemaEditor
                        key={`ref-${currentStep.reference_solution.schema_data.elements.length}`}
                        initialData={currentStep.reference_solution.schema_data}
                        readOnly={true}
                        compact={true}
                        width={700}
                        height={400}
                        isTeacher={false}
                      />
                    </Suspense>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                      Эталонная схема не заполнена учителем
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col md:flex-row gap-3 md:justify-end">
              <button
                type="button"
                onClick={() => {
                  // Оставляем шаг незавершённым и закрываем модалку для доработки схемы
                  setShowSchemaCompareModal(false);
                }}
                className="btn-secondary w-full md:w-auto"
              >
                Нет, хочу ещё поправить схему
              </button>
              <button
                type="button"
                onClick={() => {
                  // Подтверждаем корректность схемы, отмечаем шаг завершённым и идём дальше
                  setStepAttempts({
                    ...stepAttempts,
                    [currentStepOrder]: {
                      ...(stepAttempts[currentStepOrder] || {}),
                      final_answer: "(схема построена и подтверждена)",
                      is_correct: true,
                    },
                  });
                  setShowSchemaCompareModal(false);
                  handleNextStep();
                }}
                className="btn-primary w-full md:w-auto"
              >
                Да, схема правильная →
              </button>
            </div>
          </div>
        </FullScreenModal>
      )}
    </>
  );
}

// ============================================================================
// STAGE: COMPLETED
// ============================================================================

function SemiCircleGauge({ value = 0 }) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, Number(value) || 0));
    let frameId = null;
    let start = null;
    const duration = 900;

    const tick = (ts) => {
      if (!start) start = ts;
      const progress = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedValue(target * eased);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [value]);

  const radius = 90;
  const centerX = 120;
  const centerY = 120;
  const circumference = Math.PI * radius;
  const progressLen = (animatedValue / 100) * circumference;
  const dashOffset = circumference - progressLen;

  return (
    <div className="w-full flex justify-center">
      <svg viewBox="0 0 240 150" className="w-full max-w-sm">
        <path
          d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 100ms linear" }}
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <text x={centerX} y="85" textAnchor="middle" className="text-4xl font-bold" fill="#0f172a" fontSize="36">{animatedValue.toFixed(0)}%</text>
        <text x={centerX} y="108" textAnchor="middle" fill="#64748b" fontSize="12">итоговый результат</text>
      </svg>
    </div>
  );
}

function StageCompleted() {
  const { session, handleBackToCatalog, ksData, updateSession, accountProfile } = useApp();
  const isPilotMode = !!accountProfile?.is_pilot_mode;
  const snap =
    session?.has_completed && session?.last_completed && !session?.id
      ? {
          ...session,
          ...session.last_completed,
          result_summary: session.result_summary || session.last_completed.result_summary,
        }
      : session;
  const rs = snap?.result_summary || {};
  const solved = snap?.tasks_solved_count || 0;
  const totalAttempts = rs.total_attempts || 0;
  const firstTry = rs.solved_on_first_try || 0;
  const wrongAttempts = Math.max(0, totalAttempts - solved);
  const score = Number(snap?.score_percent || 0);
  const summaries = rs.task_summaries || [];
  const finalReview = snap?.final_review || null;

  const handleStartNewFromCompleted = async () => {
    try {
      await ensureCSRFCookie();
      const res = await fetch(`/api/session/start_new/?ks_id=${ksData?.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie(),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Не удалось начать заново");
      }
      window.localStorage.removeItem(STEP_BY_STEP_TASK_KEY);
      await updateSession();
    } catch (e) {
      console.error(e);
      alert("Ошибка: " + e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card p-6 md:p-8 animate-fadeIn">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pop">
            <span className="text-4xl">🏆</span>
          </div>
          <h2 className="text-3xl font-bold mb-2">Отличная работа!</h2>
          <p className="text-slate-600">Вы завершили работу с системой знаний.</p>
          <p className="text-sm text-slate-500 mt-3 max-w-xl mx-auto leading-relaxed">
            Ваши ответы и фото решений сохранены.
          </p>
        </div>

        <SemiCircleGauge value={score} />

        {finalReview && (
          <div
            className={`mt-4 mb-6 rounded-xl border p-4 ${
              finalReview.status === "accepted"
                ? "border-emerald-200 bg-emerald-50"
                : finalReview.status === "rejected"
                  ? "border-amber-200 bg-amber-50"
                  : "border-blue-200 bg-blue-50"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">
              Статус финальной проверки:{" "}
              {finalReview.status === "accepted"
                ? "принято"
                : finalReview.status === "rejected"
                  ? "на доработке"
                  : "на оценивании"}
            </p>
            {finalReview.teacher_grade_2_5 != null && (
              <p className="text-sm text-slate-700 mt-1">
                Оценка учителя: <strong>{finalReview.teacher_grade_2_5}</strong>
              </p>
            )}
            {snap?.mastery_percent != null && (
              <p className="text-sm text-slate-700">
                Итоговое усвоение (система + учитель): <strong>{snap.mastery_percent}%</strong>
              </p>
            )}
            {finalReview.teacher_comment && (
              <p className="text-sm text-slate-700 mt-2 whitespace-pre-line">
                Комментарий учителя: {finalReview.teacher_comment}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 mb-8">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">{solved}</div>
            <div className="text-xs text-slate-600 mt-1">Решено задач</div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
            <div className="text-2xl font-bold text-indigo-700">{totalAttempts}</div>
            <div className="text-xs text-slate-600 mt-1">Всего попыток</div>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-center">
            <div className="text-2xl font-bold text-teal-700">{firstTry}</div>
            <div className="text-xs text-slate-600 mt-1">С 1-й попытки</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
            <div className="text-2xl font-bold text-rose-700">{wrongAttempts}</div>
            <div className="text-xs text-slate-600 mt-1">Ошибок</div>
          </div>
        </div>

        {summaries.length > 0 && (
          <div className="mb-8">
            <div className="text-sm font-bold text-slate-700 mb-3">Детали по задачам:</div>
            <div className="space-y-2">
              {summaries.map((t, i) => (
                <div key={t.task_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${t.is_solved ? (t.attempts_count === 1 ? "bg-emerald-500" : "bg-amber-500") : "bg-rose-500"}`}>
                      {i + 1}
                    </span>
                    <span className="text-slate-700 truncate max-w-[250px] text-sm font-medium">{t.task_title || `Задача ${i + 1}`}</span>
                  </div>
                  <div className="text-xs whitespace-nowrap">
                    {t.is_solved ? (
                      t.attempts_count === 1
                        ? <span className="text-emerald-600 font-semibold">с 1-й попытки</span>
                        : <span className="text-amber-600 font-semibold">с {t.first_correct_attempt}-й попытки</span>
                    ) : (
                      <span className="text-rose-600 font-semibold">не решена</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={handleBackToCatalog} className="btn-primary btn-lg w-full sm:flex-1">
            Вернуться к каталогу
          </button>
          {isPilotMode && (
            <button type="button" onClick={handleStartNewFromCompleted} className="btn-outline btn-lg w-full sm:flex-1">
              Пройти эту систему знаний заново
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCHEMA EDITOR SECTION
// ============================================================================

function SchemaEditorSection({ taskId, sessionId, onSchemaSaved }) {
  const [isOpen, setIsOpen] = useState(true); // Открыт по умолчанию
  const [schemaData, setSchemaData] = useState(null);
  const [starterSchema, setStarterSchema] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Загружаем начальную заготовку схемы
  const loadStarterSchema = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/task/${taskId}/`);
      const data = await res.json();
      
      // Ищем заготовку (starter) или эталонную схему для начала работы
      const starter = data.schema_templates?.find(t => t.template_type === "starter");
      
      // Используем starter если есть, иначе пустую схему
      if (starter?.data) {
        setStarterSchema(starter.data);
      } else {
        // Пустая схема с базовыми настройками
        setStarterSchema({ width: 800, height: 500, elements: [] });
      }
    } catch (e) {
      console.error("Failed to load schema:", e);
      setStarterSchema({ width: 800, height: 500, elements: [] });
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadStarterSchema();
  }, [loadStarterSchema]);

  const handleSave = async (data) => {
    setSchemaData(data);
    if (onSchemaSaved) {
      onSchemaSaved(data);
    }
    setSaving(true);
    
    try {
      // Сохраняем схему ученика на сервер
      await fetch(`/api/task/${taskId}/save_student_schema/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie()
        },
        body: JSON.stringify({
          session_id: sessionId,
          schema_data: data
        })
      });
      setSaved(true);
    } catch (e) {
      console.error("Failed to save schema:", e);
      alert("Ошибка сохранения схемы");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 border-2 border-purple-200 rounded-xl overflow-hidden bg-purple-50/30">
      {/* Заголовок */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📐</span>
          <div className="text-left">
            <span className="font-semibold text-purple-900">Модель ситуации</span>
            <p className="text-xs text-purple-600">Постройте схему к задаче перед решением</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded animate-pulse">
              Сохранение...
            </span>
          )}
          {saved && !saving && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
              ✓ Сохранено
            </span>
          )}
          <svg 
            className={`w-5 h-5 text-purple-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Редактор */}
      {isOpen && (
        <div className="p-4 border-t border-purple-200 bg-white">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            }>
              <SchemaEditor
                initialData={schemaData || starterSchema}
                onSave={handleSave}
                mode="student"
              />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================================
// ICONS
// ============================================================================

function ChevronIcon({ expanded, size = "md" }) {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <svg 
      className={`${sizeClass} text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
