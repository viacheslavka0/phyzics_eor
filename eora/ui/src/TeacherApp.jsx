import React, { useEffect, useState, lazy, Suspense, useCallback } from "react";

/**
 * EORA Teacher Panel — Интерфейс учителя
 * - Структура курса (Разделы, Темы, Системы Знаний)
 * - Редактор осмысления (зоны на изображении, вопросы, cloze)
 * - Управление задачами
 */

const SchemaEditor = lazy(() => import("./components/SchemaEditor"));
const ElementCreatorVisual = lazy(() => import("./components/ElementCreatorVisual"));

const UNIT_GROUP_OPTIONS = [
  {
    key: "length",
    label: "Длина",
    units: ["см", "м", "км"],
  },
  {
    key: "time",
    label: "Время",
    units: ["с", "мин", "ч", "сут", "лет"],
  },
  {
    key: "speed",
    label: "Скорость",
    units: ["м/с", "км/ч", "км/с"],
  },
];

// =============================================================================
// UTILS
// =============================================================================

const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

const ensureCSRFCookie = async () => {
  if (getCSRFCookie()) return;
  await fetch("/api/csrf/", { credentials: "include" });
};

const api = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCSRFCookie(),
      ...options.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("Нет доступа. Войдите на /app/ под учётной записью с правами staff.");
    }
    if (res.status === 401) {
      throw new Error("Требуется вход. Откройте /app/ и войдите снова.");
    }
    const error = await res.json().catch(() => ({ detail: "Ошибка сервера" }));
    throw new Error(error.detail || "Ошибка");
  }
  return res.json();
};

/** Числовой ответ + единица или текстовый ответ — для списков в панели учителя */
function formatTeacherTaskAnswer(task) {
  if (!task) return null;
  const unit = (task.answer_unit || "").trim();
  if (task.correct_answer != null && task.correct_answer !== "") {
    const num = Number(task.correct_answer);
    const val = Number.isFinite(num) ? String(num) : String(task.correct_answer);
    return unit ? `${val} ${unit}` : val;
  }
  if (task.correct_answer_text) return String(task.correct_answer_text).trim();
  return null;
}

function inferUnitGroup(unit) {
  const code = String(unit || "").trim();
  return UNIT_GROUP_OPTIONS.find((group) => group.units.includes(code)) || null;
}

const apiUpload = async (url, formData) => {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRFToken": getCSRFCookie(),
    },
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Ошибка загрузки" }));
    throw new Error(error.detail || "Ошибка");
  }
  return res.json();
};

// =============================================================================
// MAIN APP
// =============================================================================

export default function TeacherApp() {
  const [view, setView] = useState("pilot-dashboard"); // pilot-dashboard | pilot-organizer | structure | ks-edit | tasks | elements | final-reviews | gradebook
  const [selectedKS, setSelectedKS] = useState(null);
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  // Poll pending review count every 60s
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const d = await api("/api/teacher/final-reviews/?status=pending");
        setPendingCount(Array.isArray(d) ? d.length : 0);
      } catch { /* ignore */ }
    };
    fetchCount();
    const id = setInterval(fetchCount, 60000);
    return () => clearInterval(id);
  }, []);

  const handleEditKS = (ks) => {
    setSelectedKS(ks);
    setView("ks-edit");
  };

  const handleBack = () => {
    setView("structure");
    setSelectedKS(null);
  };

  if (error) {
    return <ErrorScreen message={error} />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">EORA</h1>
                <p className="text-xs text-slate-500">Панель учителя</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                onClick={async () => {
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
                }}
              >
                Выйти
              </button>
              <a
                href="/app/?student=1"
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Режим ученика
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => { setView("pilot-dashboard"); setSelectedKS(null); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === "pilot-dashboard"
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              📊 Апробация
            </button>
            <button
              type="button"
              onClick={() => { setView("pilot-organizer"); setSelectedKS(null); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === "pilot-organizer"
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              👥 Классы и ученики
            </button>
            <button
              onClick={() => { setView("structure"); setSelectedKS(null); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === "structure" || view === "ks-edit"
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              📂 Структура курса
            </button>
            <button
              onClick={() => setView("tasks")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === "tasks"
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              📚 Задачи
            </button>
            <button
              onClick={() => setView("elements")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === "elements"
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              🎨 Элементы схем
            </button>
            <button
              type="button"
              onClick={() => setView("final-reviews")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                view === "final-reviews"
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              ✏️ Итоговые работы
              {pendingCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold leading-none">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setView("gradebook")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === "gradebook"
                  ? "text-indigo-600 border-indigo-600"
                  : "text-slate-600 border-transparent hover:text-slate-900"
              }`}
            >
              📋 Журнал
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {view === "pilot-dashboard" && <PilotDashboardView onGoReviews={() => setView("final-reviews")} />}
        {view === "pilot-organizer" && <PilotOrganizerView />}
        {view === "structure" && (
          <CourseStructureView onEditKS={handleEditKS} />
        )}
        {view === "ks-edit" && selectedKS && (
          <KnowledgeSystemEditView ks={selectedKS} onBack={handleBack} />
        )}
        {view === "tasks" && <TasksView />}
        {view === "elements" && <ElementsView />}
        {view === "final-reviews" && <FinalReviewsView onPendingChange={setPendingCount} />}
        {view === "gradebook" && <GradebookView />}
      </main>
    </div>
  );
}


// =============================================================================
// STRUCTURE VIEW — Разделы, Темы, Системы Знаний
// =============================================================================

function CourseStructureView({ onEditKS }) {
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [topics, setTopics] = useState([]);
  const [knowledgeSystems, setKnowledgeSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Фильтры
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  // Модальные окна
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showKSModal, setShowKSModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [catalogData, sectionsData, topicsData, ksData] = await Promise.all([
        api("/api/catalog/"),
        api("/api/teacher/sections/"),
        api("/api/teacher/topics/"),
        api("/api/teacher/ks-full/"),
      ]);
      setClasses(catalogData);
      setSections(sectionsData);
      setTopics(topicsData);
      setKnowledgeSystems(ksData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Фильтрация
  const filteredSections = sections.filter(s => 
    !selectedClass || s.school_class === parseInt(selectedClass)
  );
  
  const filteredTopics = topics.filter(t =>
    (!selectedClass || t.section_title?.includes(selectedClass)) &&
    (!selectedSection || t.section === parseInt(selectedSection))
  );
  
  const filteredKS = knowledgeSystems.filter(ks =>
    (!selectedTopic || ks.topic === parseInt(selectedTopic))
  );

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen message={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Структура курса</h2>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Класс</label>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setSelectedSection("");
              setSelectedTopic("");
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Все классы</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Раздел</label>
          <select
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setSelectedTopic("");
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Все разделы</option>
            {filteredSections.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Тема</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Все темы</option>
            {filteredTopics.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Три колонки */}
      <div className="grid grid-cols-3 gap-6">
        {/* Разделы */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">📁 Разделы</h3>
            <button
              onClick={() => { setEditItem(null); setShowSectionModal(true); }}
              className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"
              title="Добавить раздел"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="p-2 max-h-96 overflow-y-auto">
            {filteredSections.length === 0 ? (
              <p className="text-sm text-slate-500 p-4 text-center">Нет разделов</p>
            ) : (
              filteredSections.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSection(String(s.id))}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedSection === String(s.id)
                      ? "bg-indigo-50 border border-indigo-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <p className="font-medium text-slate-800">{s.title}</p>
                  <p className="text-xs text-slate-500">Порядок: {s.order}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Темы */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">📑 Темы</h3>
            <button
              onClick={() => { setEditItem(null); setShowTopicModal(true); }}
              className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"
              title="Добавить тему"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="p-2 max-h-96 overflow-y-auto">
            {filteredTopics.length === 0 ? (
              <p className="text-sm text-slate-500 p-4 text-center">Нет тем</p>
            ) : (
              filteredTopics.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTopic(String(t.id))}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTopic === String(t.id)
                      ? "bg-indigo-50 border border-indigo-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <p className="font-medium text-slate-800">{t.title}</p>
                  <p className="text-xs text-slate-500">{t.section_title}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Системы Знаний */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">📖 Системы Знаний</h3>
            <button
              onClick={() => { setEditItem(null); setShowKSModal(true); }}
              className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"
              title="Добавить Систему Знаний"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="p-2 max-h-96 overflow-y-auto">
            {filteredKS.length === 0 ? (
              <p className="text-sm text-slate-500 p-4 text-center">Нет Систем Знаний</p>
            ) : (
              filteredKS.map((ks) => (
                <div
                  key={ks.id}
                  className="p-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{ks.title}</p>
                      <p className="text-xs text-slate-500">{ks.topic_title}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {ks.zones_count || 0} зон
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {ks.questions_count || 0} вопросов
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {ks.tasks_count || 0} задач
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onEditKS(ks)}
                      className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Модальные окна */}
      {showSectionModal && (
        <SectionModal
          classes={classes}
          item={editItem}
          onClose={() => setShowSectionModal(false)}
          onSaved={() => { setShowSectionModal(false); loadData(); }}
        />
      )}
      {showTopicModal && (
        <TopicModal
          sections={sections}
          item={editItem}
          onClose={() => setShowTopicModal(false)}
          onSaved={() => { setShowTopicModal(false); loadData(); }}
        />
      )}
      {showKSModal && (
        <KSModal
          topics={topics}
          item={editItem}
          onClose={() => setShowKSModal(false)}
          onSaved={() => { setShowKSModal(false); loadData(); }}
        />
      )}
    </div>
  );
}


// =============================================================================
// KS EDIT VIEW — Редактор Системы Знаний (осмысление)
// =============================================================================

function KnowledgeSystemEditView({ ks, onBack }) {
  const [activeTab, setActiveTab] = useState("info"); // info | comprehension | typical_task | method | tasks
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadKSData();
  }, [ks.id]);

  const loadKSData = async () => {
    try {
      setLoading(true);
      const result = await api(`/api/teacher/ks-full/${ks.id}/comprehension/`);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{ks.title}</h2>
            <p className="text-sm text-slate-500">{ks.topic_title} • {ks.section_title}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "info" ? "text-indigo-600 border-indigo-600" : "text-slate-600 border-transparent"
            }`}
          >
            📝 Основное
          </button>
          <button
            onClick={() => setActiveTab("comprehension")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "comprehension" ? "text-indigo-600 border-indigo-600" : "text-slate-600 border-transparent"
            }`}
          >
            🖼️ Осмысление
          </button>
          <button
            onClick={() => setActiveTab("typical_task")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "typical_task" ? "text-indigo-600 border-indigo-600" : "text-slate-600 border-transparent"
            }`}
          >
            🧩 Формулирование типовой задачи
          </button>
          <button
            onClick={() => setActiveTab("method")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "method" ? "text-indigo-600 border-indigo-600" : "text-slate-600 border-transparent"
            }`}
          >
            🔢 Метод решения
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "tasks" ? "text-indigo-600 border-indigo-600" : "text-slate-600 border-transparent"
            }`}
          >
            📋 Задачи ({ks.tasks_count || 0})
          </button>
        </div>

        <div className="p-6">
          {activeTab === "info" && <KSInfoTab ks={ks} onUpdated={loadKSData} />}
          {activeTab === "comprehension" && data && (
            <ComprehensionTab ksId={ks.id} data={data} onUpdated={loadKSData} />
          )}
          {activeTab === "typical_task" && <TypicalTaskTab ks={ks} />}
          {activeTab === "method" && <MethodTab ksId={ks.id} />}
          {activeTab === "tasks" && <TasksTab ksId={ks.id} />}
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// TABS
// =============================================================================

function KSInfoTab({ ks, onUpdated }) {
  const [formData, setFormData] = useState({
    title: ks.title || "",
    description: ks.description || "",
    typical_task_title: ks.typical_task_title || "",
    typical_task_description: ks.typical_task_description || "",
    status: ks.status || "draft",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api(`/api/teacher/ks-full/${ks.id}/`, {
        method: "PATCH",
        body: JSON.stringify(formData),
      });
      onUpdated();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Типовая задача — название</label>
        <input
          type="text"
          value={formData.typical_task_title}
          onChange={(e) => setFormData({ ...formData, typical_task_title: e.target.value })}
          placeholder="Найти значения физических величин..."
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Типовая задача — описание</label>
        <textarea
          value={formData.typical_task_description}
          onChange={(e) => setFormData({ ...formData, typical_task_description: e.target.value })}
          rows={3}
          placeholder="С какой целью и в каких ситуациях применяется Система Знаний..."
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="draft">Черновик</option>
          <option value="published">Опубликовано</option>
        </select>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "💾 Сохранить"}
      </button>
    </div>
  );
}


function ComprehensionTab({ ksId, data, onUpdated }) {
  const [imageUrl, setImageUrl] = useState(data.comprehension_image);
  const [zones, setZones] = useState(data.zones || []);
  // Вопросы для осмысления (без текстов с пропусками — они вынесены в отдельную вкладку типовой задачи)
  const [questions, setQuestions] = useState(() =>
    (data.questions || [])
      .map(q => ({ ...q, _type: "question" }))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  );
  const [threshold, setThreshold] = useState(data.comprehension_pass_threshold || 85);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("image"); // image | questions

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);
    formData.append("type", "comprehension");

    try {
      const result = await apiUpload(`/api/teacher/ks-full/${ksId}/upload_image/`, formData);
      setImageUrl(result.url);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // На этом этапе сохраняем только обычные вопросы осмысления (без текстов с пропусками)
      const regularQuestions = questions;
      const clozes = [];

      await api(`/api/teacher/ks-full/${ksId}/save_comprehension/`, {
        method: "POST",
        body: JSON.stringify({
          zones,
          questions: regularQuestions,
          clozes,
          comprehension_pass_threshold: threshold,
        }),
      });
      alert("Сохранено!");
      onUpdated();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Секции */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSection("image")}
          className={`px-4 py-2 text-sm rounded-lg ${
            activeSection === "image" ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          🖼️ Изображение и зоны
        </button>
        <button
          onClick={() => setActiveSection("questions")}
          className={`px-4 py-2 text-sm rounded-lg ${
            activeSection === "questions" ? "bg-indigo-100 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          ❓ Вопросы ({questions.length})
        </button>
      </div>

      {/* Секция: Изображение и зоны */}
      {activeSection === "image" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Изображение таблицы
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          {imageUrl && (
            <div className="border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-600 mb-2">
                Нарисуйте прямоугольные зоны на изображении (в разработке)
              </p>
              <ZoneEditor
                imageUrl={imageUrl}
                zones={zones}
                onZonesChange={setZones}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Порог прохождения (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value) || 85)}
              className="w-32 px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Секция: Вопросы */}
      {activeSection === "questions" && (
        <div className="space-y-4">
          {imageUrl && (
            <div>
              <p className="text-sm text-slate-600 mb-2">
                Таблица с отмеченными зонами (для удобства при выборе правильных зон в вопросах)
              </p>
              <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <div className="max-h-64 flex items-center justify-center overflow-auto bg-slate-900/5">
                  <img
                    src={imageUrl}
                    alt="Таблица системы знаний"
                    className="max-h-64 w-auto"
                  />
                </div>
              </div>
            </div>
          )}

          <QuestionsEditor
            questions={questions}
            zones={zones}
            onChange={setQuestions}
          />
        </div>
      )}

      {/* Кнопка сохранения */}
      <div className="pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "💾 Сохранить всё"}
        </button>
      </div>
    </div>
  );
}


// =============================================================================
// TYPICAL TASK TAB — Формулирование типовой задачи
// =============================================================================

function TypicalTaskTab({ ks }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState([]);
  const [methodSteps, setMethodSteps] = useState([]);
  const [cloze, setCloze] = useState({
    original_text: "",
    blanks: [],
    distractors: [],
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [data, ksDetails] = await Promise.all([
          api(`/api/teacher/ks-full/${ks.id}/typical_task/`),
          api(`/api/ks/${ks.id}/`),
        ]);
        setOptions(data.options || []);
        const steps = [...(ksDetails?.solution_method?.steps || [])]
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        setMethodSteps(steps);

        // Текст с пропусками для типовой задачи: если уже есть, позволяем задать заново
        if (data.cloze) {
          setCloze({
            original_text: data.cloze.text || "",
            blanks: [],
            distractors: data.cloze.distractors || [],
          });
        } else {
          setCloze({
            original_text: "",
            blanks: [],
            distractors: [],
          });
        }
      } catch (e) {
        alert(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [ks.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        options: options.map((opt, index) => ({
          ...opt,
          order: index + 1,
        })),
        cloze:
          cloze && cloze.original_text && cloze.original_text.trim()
            ? {
                original_text: cloze.original_text,
                blanks: cloze.blanks || [],
                distractors: cloze.distractors || [],
              }
            : null,
      };

      await api(`/api/teacher/ks-full/${ks.id}/save_typical_task/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      alert("Типовая задача сохранена!");
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBuildFromMethod = () => {
    if (!methodSteps.length) {
      alert("Для этой системы знаний пока не заполнены шаги метода решения.");
      return;
    }
    const text = methodSteps
      .map((step) => {
        const title = (step?.title || "").trim();
        const description = (step?.description || "").trim();
        if (description) return `Шаг ${step.order}. ${title}. ${description}`;
        return `Шаг ${step.order}. ${title}`;
      })
      .join("\n");
    setCloze({
      original_text: text,
      blanks: [],
      distractors: [],
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Загрузка...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Подсказка */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-2">Формулирование типовой задачи</h3>
        <p className="text-sm text-slate-600">
          Здесь задаются варианты ответа для вопроса{" "}
          <strong>«С какой целью и в каких ситуациях можно применить эту систему знаний?»</strong>, а также
          формулировка типовой задачи в виде текста с пропусками.
        </p>
      </div>

      {/* Варианты типовой задачи */}
      <TypicalTaskOptionsEditor options={options} onChange={setOptions} />

      {/* Текст с пропусками для формулировки */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-slate-700">Формулировка типовой задачи — текст с пропусками</h4>
          <button
            type="button"
            onClick={handleBuildFromMethod}
            className="px-3 py-2 text-sm border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50"
          >
            Вставить полный алгоритм из БД
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-1">
          Можно вставить полный алгоритм из шагов метода, затем выделить нужные слова мышкой как пропуски.
          Добавьте также слова-отвлекатели.
        </p>
        <ClozeQuestionEditor
          question={cloze}
          onUpdate={(updates) => setCloze((prev) => ({ ...prev, ...updates }))}
        />
      </div>

      {/* Сохранение */}
      <div className="pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "💾 Сохранить формулировку типовой задачи"}
        </button>
      </div>
    </div>
  );
}


function TypicalTaskOptionsEditor({ options, onChange }) {
  const handleAddOption = () => {
    const newOpt = {
      id: `opt_${Date.now()}`,
      text: "",
      is_correct: false,
      explanation: "",
    };
    onChange([...(options || []), newOpt]);
  };

  const handleUpdateOption = (index, updates) => {
    const updated = options.map((opt, i) => {
      if (i === index) {
        return { ...opt, ...updates };
      }
      // Обеспечиваем один правильный вариант
      if (updates.is_correct && i !== index) {
        return { ...opt, is_correct: false };
      }
      return opt;
    });
    onChange(updated);
  };

  const handleDeleteOption = (index) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-700">Варианты формулировки типовой задачи</h4>
        <button
          onClick={handleAddOption}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Добавить вариант
        </button>
      </div>

      {(!options || options.length === 0) && (
        <p className="text-sm text-slate-500">
          Варианты не заданы. Добавьте несколько близких по смыслу формулировок, одна из которых будет правильной.
        </p>
      )}

      <div className="space-y-3">
        {options.map((opt, index) => (
          <div key={opt.id || index} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white">
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <input
                  type="radio"
                  name="typical_correct_option"
                  checked={!!opt.is_correct}
                  onChange={(e) => handleUpdateOption(index, { is_correct: e.target.checked })}
                />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Текст варианта
                    {index === 0 && " (правильная формулировка)"}
                  </label>
                  <textarea
                    value={opt.text || ""}
                    onChange={(e) => handleUpdateOption(index, { text: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder={`Вариант ${index + 1}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Пояснение (почему этот вариант верный / неверный)
                  </label>
                  <textarea
                    value={opt.explanation || ""}
                    onChange={(e) => handleUpdateOption(index, { explanation: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="Краткий комментарий для обратной связи ученику"
                  />
                </div>
              </div>
              <button
                onClick={() => handleDeleteOption(index)}
                className="text-red-500 hover:text-red-700 text-sm px-2"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MethodTab({ ksId }) {
  const [method, setMethod] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingStep, setEditingStep] = useState(null); // null | step object | "new"

  useEffect(() => {
    loadMethod();
  }, [ksId]);

  const loadMethod = async () => {
    try {
      setLoading(true);
      const data = await api(`/api/ks/${ksId}/method/`);
      setMethod({
        title: data.title || "",
        description: data.description || "",
      });
      setSteps(data.steps || []);
    } catch (e) {
      // Метод не существует - это нормально, создадим новый
      setMethod({ title: "", description: "" });
      setSteps([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMethod = async () => {
    if (!method.title.trim()) {
      alert("Введите название метода");
      return;
    }

    setSaving(true);
    try {
      await api(`/api/ks/${ksId}/save_method/`, {
        method: "POST",
        body: JSON.stringify(method),
      });
      await loadMethod();
      alert("Метод решения сохранен!");
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStep = async (stepData) => {
    setSaving(true);
    try {
      await api(`/api/ks/${ksId}/save_step/`, {
        method: "POST",
        body: JSON.stringify(stepData),
      });
      await loadMethod();
      setEditingStep(null);
      alert("Шаг сохранен!");
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async (stepId) => {
    if (!confirm("Удалить этот шаг?")) return;
    
    setSaving(true);
    try {
      await api(`/api/ks/${ksId}/delete_step/`, {
        method: "POST",
        body: JSON.stringify({ step_id: stepId }),
      });
      await loadMethod();
      alert("Шаг удален!");
    } catch (e) {
      alert("Ошибка удаления: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Редактор метода */}
      <div className="bg-slate-50 rounded-lg p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Основная информация о методе</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Название метода <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={method.title}
              onChange={(e) => setMethod({ ...method, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              placeholder="Например: Метод решения задач на применение системы знаний о равномерном и неравномерном движении"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Описание метода
            </label>
            <textarea
              value={method.description}
              onChange={(e) => setMethod({ ...method, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              placeholder="Краткое описание метода решения..."
            />
          </div>
          <button
            onClick={handleSaveMethod}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Сохранить метод"}
          </button>
        </div>
      </div>

      {/* Список шагов */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Шаги метода решения</h3>
          <button
            onClick={() => setEditingStep("new")}
            disabled={!method.title || saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
          >
            + Добавить шаг
          </button>
        </div>

        {steps.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
            <p>Шаги метода не добавлены</p>
            <p className="text-sm mt-1">Сначала сохраните метод, затем добавьте шаги</p>
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.id} className="bg-white border border-slate-200 rounded-lg p-4">
                {editingStep?.id === step.id ? (
                  <StepEditor
                    step={step}
                    onSave={handleSaveStep}
                    onCancel={() => setEditingStep(null)}
                    maxOrder={steps.length}
                  />
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                          {step.order}
                        </div>
                        <h4 className="font-semibold text-slate-900">{step.title}</h4>
                      </div>
                      {step.description && (
                        <p className="text-sm text-slate-600 ml-11 mb-1">{step.description}</p>
                      )}
                      {step.hint && (
                        <p className="text-xs text-slate-500 ml-11 italic">💡 {step.hint}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setEditingStep(step)}
                        className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Редактор нового шага */}
      {editingStep === "new" && (
        <div className="bg-white border-2 border-indigo-200 rounded-lg p-6">
          <StepEditor
            step={null}
            onSave={(stepData) => {
              handleSaveStep(stepData);
              setEditingStep(null);
            }}
            onCancel={() => setEditingStep(null)}
            maxOrder={steps.length}
          />
        </div>
      )}
    </div>
  );
}

function StepEditor({ step, onSave, onCancel, maxOrder }) {
  const [formData, setFormData] = useState({
    step_id: step?.id || null,
    order: step?.order || (maxOrder + 1),
    title: step?.title || "",
    description: step?.description || "",
    hint: step?.hint || "",
    hide_title_in_composition: step?.hide_title_in_composition || false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Введите название шага");
      return;
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Порядок <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={formData.order}
            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            required
          />
        </div>
        <div className="col-span-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Название шага <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            placeholder="Например: Выделите движущееся тело"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Описание шага
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="Подробное описание действия..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Подсказка ученику
        </label>
        <input
          type="text"
          value={formData.hint}
          onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="Краткая подсказка..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="hide_title"
          checked={formData.hide_title_in_composition}
          onChange={(e) => setFormData({ ...formData, hide_title_in_composition: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="hide_title" className="text-sm text-slate-700">
          Скрыть название шага на этапе составления метода
        </label>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
        >
          Отмена
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Сохранить шаг
        </button>
      </div>
    </form>
  );
}


function TasksTab({ ksId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const data = await api(`/api/teacher/tasks/?ks=${ksId}`);
        if (!cancelled) setTasks(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ksId]);

  if (loading) {
    return <p className="text-sm text-slate-500">Загрузка списка задач…</p>;
  }
  if (err) {
    return <p className="text-sm text-red-600">{err}</p>;
  }
  if (tasks.length === 0) {
    return (
      <div className="text-slate-500 text-center py-6">
        <p>Задач для этой системы знаний пока нет.</p>
        <p className="text-sm mt-2">Создайте их в разделе «Задачи» главного меню.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 mb-4">
        Ниже — условие и <strong>правильный ответ</strong> по каждой задаче. Редактирование — в меню «Задачи».
      </p>
      {tasks.map((task) => {
        const ans = formatTeacherTaskAnswer(task);
        return (
          <div
            key={task.id}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-semibold text-slate-900">
                <span className="text-indigo-600">{task.order}.</span> {task.title}
              </h4>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  task.difficulty <= 2 ? "bg-green-100 text-green-700" :
                  task.difficulty <= 3 ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700"
                }`}
              >
                {["", "Очень лёгкая", "Лёгкая", "Средняя", "Сложная", "Очень сложная"][task.difficulty]}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2 line-clamp-3 whitespace-pre-line">{task.text}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">Ответ</span>
              {ans ? (
                <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-900">
                  {ans}
                </span>
              ) : (
                <span className="text-sm text-amber-700 italic">не задан</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// =============================================================================
// ZONE EDITOR — Редактор зон на изображении
// =============================================================================

function ZoneEditor({ imageUrl, zones, onZonesChange }) {
  const containerRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const handleMouseDown = (e) => {
    if (e.target.tagName === "IMG" || e.target.classList.contains("zone-overlay")) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setIsDrawing(true);
      setStartPos({ x, y });
      setCurrentRect({ x, y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !startPos) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentRect({
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      width: Math.abs(x - startPos.x),
      height: Math.abs(y - startPos.y),
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentRect && currentRect.width > 20 && currentRect.height > 20) {
      const newZone = {
        id: `zone_${Date.now()}`,
        ...currentRect,
        label: `Зона ${zones.length + 1}`,
      };
      onZonesChange([...zones, newZone]);
    }
    setIsDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  };

  const handleDeleteZone = (zoneId) => {
    onZonesChange(zones.filter(z => z.id !== zoneId));
    setSelectedZone(null);
  };

  const handleUpdateLabel = (zoneId, label) => {
    onZonesChange(zones.map(z => z.id === zoneId ? { ...z, label } : z));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Нарисуйте прямоугольники, чтобы выделить зоны на таблице.
        Клик на зону — выбрать, Delete — удалить.
      </p>
      
      <div
        ref={containerRef}
        className="relative inline-block border border-slate-300 rounded-lg overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt="Таблица"
          className="max-w-full"
          style={{ maxHeight: "500px" }}
          draggable={false}
        />
        
        {/* Существующие зоны */}
        {zones.map((zone) => (
          <div
            key={zone.id}
            className={`absolute border-2 cursor-pointer zone-overlay ${
              selectedZone === zone.id
                ? "border-indigo-500 bg-indigo-500/20"
                : "border-yellow-500 bg-yellow-500/20"
            }`}
            style={{
              left: zone.x,
              top: zone.y,
              width: zone.width,
              height: zone.height,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedZone(zone.id);
            }}
          >
            <span className="absolute -top-6 left-0 text-xs bg-yellow-500 text-white px-1 rounded">
              {zone.label}
            </span>
          </div>
        ))}
        
        {/* Рисуемый прямоугольник */}
        {currentRect && currentRect.width > 0 && (
          <div
            className="absolute border-2 border-dashed border-indigo-500 bg-indigo-500/10"
            style={{
              left: currentRect.x,
              top: currentRect.y,
              width: currentRect.width,
              height: currentRect.height,
            }}
          />
        )}
      </div>

      {/* Список зон */}
      {zones.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Зоны ({zones.length}):</h4>
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                  selectedZone === zone.id ? "bg-indigo-100" : "bg-slate-100"
                }`}
              >
                <input
                  type="text"
                  value={zone.label}
                  onChange={(e) => handleUpdateLabel(zone.id, e.target.value)}
                  className="w-24 px-2 py-0.5 text-sm border border-slate-300 rounded"
                />
                <button
                  onClick={() => handleDeleteZone(zone.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// =============================================================================
// QUESTIONS EDITOR — Редактор вопросов
// =============================================================================

function QuestionsEditor({ questions, zones, onChange }) {
  const [editingQuestion, setEditingQuestion] = useState(null);

  const handleAddQuestion = () => {
    const newQuestion = {
      id: `q_${Date.now()}`,
      type: "single",
      text: "",
      order: questions.length + 1,
      options: [{ text: "", is_correct: false }],
      zone_ids: [],
      correct_zone_ids: [],
      correct_answer_text: "",
      fuzzy_match: false,
    };
    onChange([...questions, newQuestion]);
    setEditingQuestion(newQuestion.id);
  };

  const handleUpdateQuestion = (id, updates) => {
    onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const handleDeleteQuestion = (id) => {
    onChange(questions.filter(q => q.id !== id));
    if (editingQuestion === id) setEditingQuestion(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-700">Вопросы</h4>
        <button
          onClick={handleAddQuestion}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Добавить вопрос
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">Нет вопросов</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <QuestionItem
              key={q.id}
              question={q}
              index={idx}
              zones={zones}
              isExpanded={editingQuestion === q.id}
              onToggle={() => setEditingQuestion(editingQuestion === q.id ? null : q.id)}
              onUpdate={(updates) => handleUpdateQuestion(q.id, updates)}
              onDelete={() => handleDeleteQuestion(q.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionItem({ question, index, zones, isExpanded, onToggle, onUpdate, onDelete }) {
  const typeLabels = {
    text: "Открытый ответ",
    single: "Выбор одного",
    multiple: "Множественный выбор",
    match: "Соответствие с зонами",
  };

  return (
    <div className="border border-slate-200 rounded-lg">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-slate-800 truncate max-w-md">
            {question.type === "cloze" 
              ? (question.original_text?.substring(0, 50) || "Текст с пропусками") + "..."
              : (question.text || "Новый вопрос")}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${
            question.type === "cloze" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"
          }`}>
            {typeLabels[question.type] || question.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-red-500 hover:text-red-700 p-1"
          >
            🗑️
          </button>
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 border-t border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Тип вопроса</label>
            <select
              value={question.type}
              onChange={(e) => onUpdate({ type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="text">Открытый ответ</option>
              <option value="single">Выбор одного варианта</option>
              <option value="multiple">Множественный выбор</option>
              <option value="match">Соответствие с зонами</option>
            </select>
          </div>

          {/* Обычные вопросы: текст вопроса */}
          {question.type !== "cloze" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Текст вопроса</label>
              <textarea
                value={question.text || ""}
                onChange={(e) => onUpdate({ text: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="Введите текст вопроса..."
              />
            </div>
          )}

          {/* Тип: text */}
          {question.type === "text" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Правильный ответ</label>
              <input
                type="text"
                value={question.correct_answer_text || ""}
                onChange={(e) => onUpdate({ correct_answer_text: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={question.fuzzy_match || false}
                  onChange={(e) => onUpdate({ fuzzy_match: e.target.checked })}
                />
                <span className="text-sm text-slate-600">Игнорировать регистр и пробелы</span>
              </label>
            </div>
          )}

          {/* Тип: single / multiple */}
          {(question.type === "single" || question.type === "multiple") && (
            <OptionsEditor
              options={question.options || []}
              multiple={question.type === "multiple"}
              onChange={(options) => onUpdate({ options })}
            />
          )}

          {/* Тип: match */}
          {question.type === "match" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Правильные зоны
              </label>
              <div className="flex flex-wrap gap-2">
                {zones.map((zone) => (
                  <label key={zone.id} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={(question.correct_zone_ids || []).includes(zone.id)}
                      onChange={(e) => {
                        const ids = question.correct_zone_ids || [];
                        if (e.target.checked) {
                          onUpdate({ correct_zone_ids: [...ids, zone.id] });
                        } else {
                          onUpdate({ correct_zone_ids: ids.filter(id => id !== zone.id) });
                        }
                      }}
                    />
                    <span className="text-sm">{zone.label}</span>
                  </label>
                ))}
              </div>
              {zones.length === 0 && (
                <p className="text-sm text-slate-500">Сначала создайте зоны на изображении</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, multiple, onChange }) {
  const handleAddOption = () => {
    onChange([...options, { text: "", is_correct: false }]);
  };

  const handleUpdateOption = (index, updates) => {
    const newOptions = options.map((opt, i) => {
      if (i === index) {
        return { ...opt, ...updates };
      }
      // Для single — снимаем is_correct с других
      if (!multiple && updates.is_correct && opt.is_correct) {
        return { ...opt, is_correct: false };
      }
      return opt;
    });
    onChange(newOptions);
  };

  const handleDeleteOption = (index) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Варианты ответов</label>
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type={multiple ? "checkbox" : "radio"}
              name="correct_option"
              checked={opt.is_correct}
              onChange={(e) => handleUpdateOption(idx, { is_correct: e.target.checked })}
            />
            <input
              type="text"
              value={opt.text}
              onChange={(e) => handleUpdateOption(idx, { text: e.target.value })}
              placeholder={`Вариант ${idx + 1}`}
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={() => handleDeleteOption(idx)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={handleAddOption}
        className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
      >
        + Добавить вариант
      </button>
    </div>
  );
}


// =============================================================================
// CLOZE EDITOR — Редактор текстов с пропусками
// =============================================================================

// Встроенный редактор для cloze в QuestionItem
function ClozeQuestionEditor({ question, onUpdate }) {
  const [text, setText] = useState(question.original_text || "");
  const [selection, setSelection] = useState(null);
  const [newDistractor, setNewDistractor] = useState("");
  const textareaRef = React.useRef(null);

  const handleTextChange = (e) => {
    setText(e.target.value);
    onUpdate({ original_text: e.target.value });
  };

  const handleSelect = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end) {
        setSelection({ start, end, text: text.substring(start, end) });
      }
    }
  };

  const handleMarkAsBlank = () => {
    if (!selection) return;

    const blanks = question.blanks || [];
    const position = blanks.length;
    
    const newBlank = {
      position,
      correct: selection.text,
      start: selection.start,
      end: selection.end,
    };

    const newBlanks = [...blanks, newBlank];
    
    // Пересчитываем marked_text на основе ВСЕХ пропусков
    const markedText = buildMarkedText(text, newBlanks);

    onUpdate({
      blanks: newBlanks,
      marked_text: markedText,
    });

    setSelection(null);
  };
  
  // Функция для построения marked_text из оригинального текста и пропусков
  const buildMarkedText = (originalText, blanks) => {
    if (!blanks || blanks.length === 0) return originalText;
    
    // Сортируем пропуски по позиции start (с конца, чтобы не сбивать индексы)
    const sortedBlanks = [...blanks].sort((a, b) => b.start - a.start);
    
    let result = originalText;
    for (const blank of sortedBlanks) {
      result = result.substring(0, blank.start) + `{{${blank.position}}}` + result.substring(blank.end);
    }
    return result;
  };

  const handleRemoveBlank = (position) => {
    const blanks = (question.blanks || []).filter(b => b.position !== position);
    // Пересчитываем позиции
    const reindexed = blanks.map((b, i) => ({ ...b, position: i }));
    // Пересчитываем marked_text
    const markedText = buildMarkedText(text, reindexed);
    onUpdate({ blanks: reindexed, marked_text: markedText });
  };

  const handleAddDistractor = () => {
    if (newDistractor.trim()) {
      onUpdate({ distractors: [...(question.distractors || []), newDistractor.trim()] });
      setNewDistractor("");
    }
  };

  const handleRemoveDistractor = (idx) => {
    onUpdate({ distractors: (question.distractors || []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4 bg-purple-50 rounded-lg p-4 border border-purple-200">
      <div>
        <label className="block text-sm font-medium text-purple-700 mb-1">
          Текст (выделите слова мышкой, чтобы сделать пропусками)
        </label>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onSelect={handleSelect}
          onMouseUp={handleSelect}
          rows={4}
          className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          placeholder="Введите текст..."
        />
        
        {selection && (
          <div className="mt-2 flex items-center gap-2 bg-yellow-100 p-2 rounded">
            <span className="text-sm text-slate-600">
              Выделено: <strong className="bg-yellow-300 px-1 rounded">{selection.text}</strong>
            </span>
            <button
              onClick={handleMarkAsBlank}
              className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              ✓ Сделать пропуском
            </button>
          </div>
        )}
      </div>

      {/* Пропуски */}
      {(question.blanks || []).length > 0 && (
        <div>
          <label className="block text-sm font-medium text-purple-700 mb-1">
            Пропуски (правильные ответы):
          </label>
          <div className="flex flex-wrap gap-2">
            {(question.blanks || []).map((blank, i) => (
              <span
                key={i}
                className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm flex items-center gap-1 border border-yellow-300"
              >
                {`[${blank.position + 1}]`}: <strong>{blank.correct}</strong>
                <button
                  onClick={() => handleRemoveBlank(blank.position)}
                  className="ml-1 text-yellow-600 hover:text-yellow-800 font-bold"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Отвлекатели */}
      <div>
        <label className="block text-sm font-medium text-purple-700 mb-1">
          Слова-отвлекатели (появятся в выпадающих списках):
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(question.distractors || []).map((d, i) => (
            <span
              key={i}
              className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-sm flex items-center gap-1"
            >
              {d}
              <button
                onClick={() => handleRemoveDistractor(i)}
                className="ml-1 text-slate-500 hover:text-slate-700 font-bold"
              >
                ×
              </button>
            </span>
          ))}
          {(question.distractors || []).length === 0 && (
            <span className="text-sm text-slate-500">Нет отвлекателей</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newDistractor}
            onChange={(e) => setNewDistractor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddDistractor())}
            placeholder="Введите слово-отвлекатель..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            onClick={handleAddDistractor}
            className="px-4 py-2 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            + Добавить
          </button>
        </div>
      </div>

      {/* Предпросмотр */}
      {(question.blanks || []).length > 0 && (
        <div className="border-t border-purple-200 pt-4">
          <label className="block text-sm font-medium text-purple-700 mb-2">
            Предпросмотр (как увидит ученик):
          </label>
          <div className="bg-white p-3 rounded border border-purple-200">
            <ClozePreview text={text} blanks={question.blanks || []} distractors={question.distractors || []} />
          </div>
        </div>
      )}
    </div>
  );
}

// Предпросмотр cloze для учителя
function ClozePreview({ text, blanks, distractors }) {
  if (!text || blanks.length === 0) return null;

  // Сортируем пропуски по позиции start
  const sortedBlanks = [...blanks].sort((a, b) => a.start - b.start);
  
  // Все варианты для выпадающих списков
  const allOptions = [...blanks.map(b => b.correct), ...distractors];
  
  let result = [];
  let lastEnd = 0;

  sortedBlanks.forEach((blank, idx) => {
    // Текст до пропуска
    if (blank.start > lastEnd) {
      result.push(<span key={`text-${idx}`}>{text.substring(lastEnd, blank.start)}</span>);
    }
    // Выпадающий список
    result.push(
      <select
        key={`blank-${idx}`}
        className="mx-1 px-2 py-1 border border-purple-300 rounded bg-purple-50 text-sm"
        disabled
      >
        <option value="">▼ Выбрать...</option>
        {allOptions.map((opt, i) => (
          <option key={i} value={opt}>{opt}</option>
        ))}
      </select>
    );
    lastEnd = blank.end;
  });

  // Текст после последнего пропуска
  if (lastEnd < text.length) {
    result.push(<span key="text-last">{text.substring(lastEnd)}</span>);
  }

  return <div className="text-sm leading-relaxed">{result}</div>;
}

// Старый ClozeEditor — оставим на всякий случай, но он больше не используется
function ClozeEditor({ clozes, onChange }) {
  const handleAddCloze = () => {
    const newCloze = {
      id: `cloze_${Date.now()}`,
      order: clozes.length + 1,
      original_text: "",
      marked_text: "",
      blanks: [],
      distractors: [],
    };
    onChange([...clozes, newCloze]);
  };

  const handleUpdateCloze = (id, updates) => {
    onChange(clozes.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleDeleteCloze = (id) => {
    onChange(clozes.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-700">Тексты с пропусками</h4>
        <button
          onClick={handleAddCloze}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Добавить текст
        </button>
      </div>

      {clozes.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">Нет текстов с пропусками</p>
      ) : (
        <div className="space-y-4">
          {clozes.map((cloze, idx) => (
            <ClozeItem
              key={cloze.id}
              cloze={cloze}
              index={idx}
              onUpdate={(updates) => handleUpdateCloze(cloze.id, updates)}
              onDelete={() => handleDeleteCloze(cloze.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClozeItem({ cloze, index, onUpdate, onDelete }) {
  const [text, setText] = useState(cloze.original_text || "");
  const [selection, setSelection] = useState(null);
  const textareaRef = React.useRef(null);

  const handleTextChange = (e) => {
    setText(e.target.value);
    onUpdate({ original_text: e.target.value });
  };

  const handleSelect = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end) {
        setSelection({ start, end, text: text.substring(start, end) });
      }
    }
  };

  const handleMarkAsBlank = () => {
    if (!selection) return;

    const blanks = cloze.blanks || [];
    const position = blanks.length;
    
    // Создаём marked_text с маркером
    let markedText = cloze.marked_text || text;
    const newBlank = {
      position,
      correct: selection.text,
      start: selection.start,
      end: selection.end,
    };

    // Вставляем маркер
    markedText = text.substring(0, selection.start) + `{{${position}}}` + text.substring(selection.end);

    onUpdate({
      blanks: [...blanks, newBlank],
      marked_text: markedText,
    });

    setSelection(null);
  };

  const handleRemoveBlank = (position) => {
    const blanks = (cloze.blanks || []).filter(b => b.position !== position);
    // Пересчитываем позиции
    const reindexed = blanks.map((b, i) => ({ ...b, position: i }));
    
    // Восстанавливаем marked_text
    let markedText = cloze.original_text;
    reindexed.forEach((b, i) => {
      // Простая логика — в реальности нужно более сложное восстановление
    });

    onUpdate({ blanks: reindexed });
  };

  const handleAddDistractor = () => {
    const word = prompt("Введите слово-отвлекатель:");
    if (word) {
      onUpdate({ distractors: [...(cloze.distractors || []), word] });
    }
  };

  const handleRemoveDistractor = (idx) => {
    onUpdate({ distractors: (cloze.distractors || []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-800">Текст #{index + 1}</span>
        <button onClick={onDelete} className="text-red-500 hover:text-red-700">🗑️ Удалить</button>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Текст (выделите слова, чтобы сделать пропусками)
        </label>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onSelect={handleSelect}
          rows={4}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          placeholder="Введите текст..."
        />
        
        {selection && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-slate-600">
              Выделено: <strong className="bg-yellow-200 px-1">{selection.text}</strong>
            </span>
            <button
              onClick={handleMarkAsBlank}
              className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Сделать пропуском
            </button>
          </div>
        )}
      </div>

      {/* Пропуски */}
      {(cloze.blanks || []).length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Пропуски:</label>
          <div className="flex flex-wrap gap-2">
            {(cloze.blanks || []).map((blank, i) => (
              <span
                key={i}
                className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm flex items-center gap-1"
              >
                {`{{${blank.position}}}`}: {blank.correct}
                <button
                  onClick={() => handleRemoveBlank(blank.position)}
                  className="text-yellow-600 hover:text-yellow-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Отвлекатели */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Слова-отвлекатели:
        </label>
        <div className="flex flex-wrap gap-2">
          {(cloze.distractors || []).map((d, i) => (
            <span
              key={i}
              className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-sm flex items-center gap-1"
            >
              {d}
              <button
                onClick={() => handleRemoveDistractor(i)}
                className="text-slate-500 hover:text-slate-700"
              >
                ×
              </button>
            </span>
          ))}
          <button
            onClick={handleAddDistractor}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            + Добавить отвлекатель
          </button>
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// TASKS VIEW — Управление задачами
// =============================================================================

function TasksView() {
  const [tasks, setTasks] = useState([]);
  const [ksList, setKsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKs, setFilterKs] = useState("");
  const [editingTask, setEditingTask] = useState(null); // null | "new" | task object
  const [showSchemaEditor, setShowSchemaEditor] = useState(null); // task id для редактирования схемы

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tasksData, ksData] = await Promise.all([
        api("/api/teacher/tasks/"),
        api("/api/teacher/ks/"),
      ]);
      setTasks(tasksData);
      setKsList(ksData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const answerStr = formatTeacherTaskAnswer(task) || "";
    const matchesSearch =
      !searchQuery ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      answerStr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesKs = !filterKs || task.ks === parseInt(filterKs);
    return matchesSearch && matchesKs;
  });

  const handleDelete = async (taskId) => {
    if (!confirm("Удалить задачу?")) return;
    try {
      await api(`/api/teacher/tasks/${taskId}/`, { method: "DELETE" });
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;

  // Редактирование схемы
  if (showSchemaEditor) {
    const task = tasks.find(t => t.id === showSchemaEditor);
    return (
      <TaskSchemaEditor 
        task={task}
        onBack={() => { setShowSchemaEditor(null); loadData(); }}
      />
    );
  }

  // Редактирование задачи
  if (editingTask) {
    return (
      <TaskEditor
        task={editingTask === "new" ? null : editingTask}
        ksList={ksList}
        onBack={() => { setEditingTask(null); loadData(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Задачи</h2>
        <button
          onClick={() => setEditingTask("new")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Создать задачу
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Поиск..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
        />
        <select
          value={filterKs}
          onChange={(e) => setFilterKs(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg"
        >
          <option value="">Все Системы Знаний</option>
          {ksList.map((ks) => (
            <option key={ks.id} value={ks.id}>{ks.title}</option>
          ))}
        </select>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <p>Нет задач</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const answerLine = formatTeacherTaskAnswer(task);
            return (
            <div key={task.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{task.order}. {task.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      task.difficulty <= 2 ? "bg-green-100 text-green-700" :
                      task.difficulty <= 3 ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {["", "Очень лёгкая", "Лёгкая", "Средняя", "Сложная", "Очень сложная"][task.difficulty]}
                    </span>
                    {task.has_schema && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                        📐 Схема
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{task.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80">
                      Ответ
                    </span>
                    {answerLine ? (
                      <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-900">
                        {answerLine}
                      </span>
                    ) : (
                      <span className="text-sm text-amber-700 italic">не задан</span>
                    )}
                    {!!task.allowed_answer_units?.length && (
                      <span className="text-xs text-slate-500">
                        Допустимые единицы: {task.allowed_answer_units.join(", ")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{task.ks_title}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setShowSchemaEditor(task.id)}
                    className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                    title="Редактировать модель ситуации"
                  >
                    📐 Схема
                  </button>
                  <button
                    onClick={() => setEditingTask(task)}
                    className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                  >
                    ✏️ Редактировать
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TASK EDITOR — Редактор задачи (создание/редактирование)
// =============================================================================

function TaskEditor({ task, ksList, onBack }) {
  const initialUnitGroup = inferUnitGroup(task?.answer_unit)?.key || "";
  const isNew = !task;
  const [formData, setFormData] = useState({
    ks: task?.ks || (ksList[0]?.id || ""),
    order: task?.order || 1,
    title: task?.title || "",
    text: task?.text || "",
    correct_answer: task?.correct_answer || "",
    answer_unit: task?.answer_unit || "",
    allowed_answer_units: task?.allowed_answer_units || (task?.answer_unit ? [task.answer_unit] : []),
    answer_tolerance: task?.answer_tolerance || 1,
    correct_answer_text: task?.correct_answer_text || "",
    difficulty: task?.difficulty || 3,
  });
  const [saving, setSaving] = useState(false);
  const [unitGroup, setUnitGroup] = useState(initialUnitGroup);

  const selectedUnitGroup = UNIT_GROUP_OPTIONS.find((group) => group.key === unitGroup) || null;
  const selectedUnits = formData.allowed_answer_units || [];

  const toggleAllowedUnit = (unit) => {
    setFormData((prev) => {
      const current = prev.allowed_answer_units || [];
      const next = current.includes(unit)
        ? current.filter((value) => value !== unit)
        : [...current, unit];
      return {
        ...prev,
        allowed_answer_units: next,
        answer_unit: next.includes(prev.answer_unit) ? prev.answer_unit : (next[0] || ""),
      };
    });
  };

  const handleSave = async () => {
    if (!formData.ks || !formData.title.trim()) {
      alert("Заполните обязательные поля: Система Знаний и Название");
      return;
    }

    setSaving(true);
    try {
      const url = isNew ? "/api/teacher/tasks/" : `/api/teacher/tasks/${task.id}/`;
      const method = isNew ? "POST" : "PUT";
      
      await api(url, {
        method,
        body: JSON.stringify({
          ...formData,
          correct_answer: formData.correct_answer ? parseFloat(formData.correct_answer) : null,
          allowed_answer_units: formData.allowed_answer_units || [],
        }),
      });
      
      onBack();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm text-slate-600 hover:text-slate-800"
      >
        ← Назад к списку задач
      </button>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          {isNew ? "Создание задачи" : "Редактирование задачи"}
        </h2>

        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Система Знаний <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.ks}
              onChange={(e) => setFormData({ ...formData, ks: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">Выберите СК...</option>
              {ksList.map((ks) => (
                <option key={ks.id} value={ks.id}>{ks.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Порядок</label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Сложность</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value={1}>Очень лёгкая</option>
                <option value={2}>Лёгкая</option>
                <option value={3}>Средняя</option>
                <option value={4}>Сложная</option>
                <option value={5}>Очень сложная</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              placeholder="Краткое название задачи"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Условие задачи</label>
            <textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              rows={5}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              placeholder="Полный текст условия..."
            />
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <h3 className="font-medium text-slate-800 mb-3">Правильный ответ</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Числовой ответ</label>
                <input
                  type="number"
                  step="any"
                  value={formData.correct_answer}
                  onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Базовая единица</label>
                <select
                  value={formData.answer_unit}
                  onChange={(e) => setFormData({ ...formData, answer_unit: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="">Выберите...</option>
                  {selectedUnits.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Погрешность, %</label>
                <input
                  type="number"
                  value={formData.answer_tolerance}
                  onChange={(e) => setFormData({ ...formData, answer_tolerance: parseFloat(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Допустимые единицы для ученика</p>
                  <p className="text-xs text-slate-500">Сначала выберите тип величины, затем отметьте единицы, которые можно использовать в ответе.</p>
                </div>
                <select
                  value={unitGroup}
                  onChange={(e) => {
                    const nextGroup = e.target.value;
                    setUnitGroup(nextGroup);
                    const group = UNIT_GROUP_OPTIONS.find((item) => item.key === nextGroup);
                    if (!group) {
                      setFormData((prev) => ({ ...prev, answer_unit: "", allowed_answer_units: [] }));
                      return;
                    }
                    setFormData((prev) => ({
                      ...prev,
                      allowed_answer_units: group.units,
                      answer_unit: group.units.includes(prev.answer_unit) ? prev.answer_unit : group.units[0],
                    }));
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Выберите тип величины...</option>
                  {UNIT_GROUP_OPTIONS.map((group) => (
                    <option key={group.key} value={group.key}>{group.label}</option>
                  ))}
                </select>
              </div>
              {selectedUnitGroup ? (
                <div className="flex flex-wrap gap-2">
                  {selectedUnitGroup.units.map((unit) => {
                    const active = selectedUnits.includes(unit);
                    return (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => toggleAllowedUnit(unit)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          active
                            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                        }`}
                      >
                        {active ? "✓ " : ""}{unit}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Для текстовых задач можно оставить этот блок пустым.</p>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Текстовый ответ (если не числовой)
              </label>
              <input
                type="text"
                value={formData.correct_answer_text}
                onChange={(e) => setFormData({ ...formData, correct_answer_text: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Сохранение..." : (isNew ? "Создать задачу" : "Сохранить")}
            </button>
            <button
              onClick={onBack}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>

      {/* Эталонные решения по шагам (только для существующих задач) */}
      {!isNew && task && (
        <TaskSolutionStepsEditor taskId={task.id} ksId={formData.ks} />
      )}
    </div>
  );
}

// =============================================================================
// TASK SCHEMA EDITOR — Редактор модели ситуации для задачи
// =============================================================================

function TaskSchemaEditor({ task, onBack }) {
  const [schemaData, setSchemaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSchema();
  }, [task.id]);

  const loadSchema = async () => {
    try {
      // Загружаем существующую эталонную схему
      const data = await api(`/api/teacher/tasks/${task.id}/`);
      // Ищем эталонную схему среди шаблонов
      const refSchema = data.schema_templates?.find(t => t.template_type === "reference");
      setSchemaData(refSchema?.data || { width: 800, height: 600, elements: [] });
    } catch (e) {
      console.error(e);
      setSchemaData({ width: 800, height: 600, elements: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      await api(`/api/teacher/tasks/${task.id}/save_schema/`, {
        method: "POST",
        body: JSON.stringify({
          data,
          template_type: "reference",
          name: `Эталонная схема: ${task.title}`,
        }),
      });
      alert("Схема сохранена!");
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="text-sm text-slate-600 hover:text-slate-800"
        >
          ← Назад к списку задач
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-purple-50">
          <h2 className="font-bold text-purple-900">📐 Модель ситуации: {task.title}</h2>
          <p className="text-sm text-purple-700 mt-1">
            Нарисуйте эталонную схему, с которой будет сравниваться решение ученика
          </p>
        </div>

        <div className="p-4 bg-slate-100 border-b">
          <p className="text-sm text-slate-700 font-medium">Условие задачи:</p>
          <p className="text-sm text-slate-600 mt-1">{task.text}</p>
        </div>

        <Suspense fallback={<div className="p-8 text-center">Загрузка редактора...</div>}>
          <SchemaEditor
            initialData={schemaData}
            isTeacher={true}
            onSave={handleSave}
            onExport={(png) => {
              // Можно сохранить превью
              console.log("PNG exported");
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}


// =============================================================================
// TASK SOLUTION STEPS EDITOR — Редактор эталонных решений по шагам
// =============================================================================

function TaskSolutionStepsEditor({ taskId, ksId }) {
  const [methodSteps, setMethodSteps] = useState([]);
  const [solutionSteps, setSolutionSteps] = useState({});
  const [stepTypes, setStepTypes] = useState({}); // {stepOrder: "text" | "text_pick" | "schema" | "symbol" | "boolean" | "solution"}
  const [stepContents, setStepContents] = useState({}); // {stepOrder: content}
  const [stepSchemas, setStepSchemas] = useState({}); // {stepOrder: schemaData}
  const [editingSchemaStep, setEditingSchemaStep] = useState(null); // stepOrder для редактирования схемы
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taskText, setTaskText] = useState(""); // текст задачи для выбора слов
  const [textPickSelections, setTextPickSelections] = useState({}); // {stepOrder: number[]}
  // Для шага "symbol": выбор фрагмента и список пар (фрагмент + обозначение)
  const [symbolSelections, setSymbolSelections] = useState({}); // {stepOrder: number[]}
  const [symbolDrafts, setSymbolDrafts] = useState({}); // {stepOrder: { fragment, symbol }}
  const [symbolPairs, setSymbolPairs] = useState({}); // {stepOrder: [{ fragment, symbol }]}
  // Для шага "solution": структурированный блок решения
  const [solutionBlocks, setSolutionBlocks] = useState({}); // {stepOrder: { formula, si, calc, reasoning }}
  const [activeFormulaInput, setActiveFormulaInput] = useState(null); // {stepOrder, field: "formula" | "si" | "calc"}

  useEffect(() => {
    loadData();
  }, [taskId, ksId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const ksData = await api(`/api/ks/${ksId}/method/`);
      const steps = ksData.steps || [];
      setMethodSteps(steps);

      // Загружаем текст задачи, чтобы можно было выбирать слова из условия
      try {
        const task = await api(`/api/teacher/tasks/${taskId}/`);
        setTaskText(task.text || "");
      } catch (e) {
        console.error("Не удалось загрузить текст задачи для text_pick:", e);
        setTaskText("");
      }

      const existingSteps = await api(`/api/teacher/task-solution-steps/?task=${taskId}`);
      const stepsMap = {};
      const typesMap = {};
      const contentsMap = {};
      const schemasMap = {};
      existingSteps.forEach(ss => {
        const stepOrder = ss.step_order || ss.step;
        stepsMap[stepOrder] = ss;
        const stepType = ss.step_type || "text";
        typesMap[stepOrder] = stepType;
        contentsMap[stepOrder] = ss.content || "";
        if (stepType === "schema" && ss.schema_data && Object.keys(ss.schema_data).length > 0) {
          schemasMap[stepOrder] = ss.schema_data;
        }
        if (stepType === "symbol" && ss.schema_data && Array.isArray(ss.schema_data.items)) {
          // Восстанавливаем сохранённые пары "фрагмент + символ"
          const items = ss.schema_data.items.map((it) => ({
            fragment: it.fragment || "",
            symbol: it.symbol || "",
            isTarget: !!it.isTarget,
          }));
          setSymbolPairs(prev => ({
            ...prev,
            [stepOrder]: items,
          }));
        }
        if (stepType === "solution" && ss.schema_data) {
          setSolutionBlocks(prev => ({
            ...prev,
            [stepOrder]: {
              formula: ss.schema_data.formula || "",
              si: ss.schema_data.si || "",
              calc: ss.schema_data.calc || "",
              reasoning: ss.schema_data.reasoning || "",
            },
          }));
        }
      });
      setSolutionSteps(stepsMap);
      setStepTypes(typesMap);
      setStepContents(contentsMap);
      setStepSchemas(schemasMap);
    } catch (e) {
      console.error("Ошибка загрузки:", e);
    } finally {
      setLoading(false);
    }
  };

  // Получить схему предыдущего шага для наследования
  const getPreviousStepSchema = (currentStepOrder) => {
    try {
      if (!methodSteps || methodSteps.length === 0) return null;
      
      const sortedSteps = [...methodSteps].sort((a, b) => a.order - b.order);
      const currentIndex = sortedSteps.findIndex(s => s.order === currentStepOrder);
      
      if (currentIndex <= 0) return null;
      
      // Ищем предыдущий шаг со схемой
      for (let i = currentIndex - 1; i >= 0; i--) {
        const prevStep = sortedSteps[i];
        const prevStepOrder = prevStep.order;
        if (stepTypes[prevStepOrder] === "schema" && stepSchemas[prevStepOrder]) {
          // Возвращаем копию схемы предыдущего шага
          return JSON.parse(JSON.stringify(stepSchemas[prevStepOrder]));
        }
      }
      return null;
    } catch (e) {
      console.error("Ошибка получения схемы предыдущего шага:", e);
      return null;
    }
  };

  // Функция для вставки символа в активное поле формулы/расчёта
  const insertSymbol = (symbol, stepOrder, field) => {
    const currentValue = solutionBlocks[stepOrder]?.[field] || "";
    const input = document.activeElement;
    if (input && (input.tagName === "INPUT" || input.tagName === "TEXTAREA")) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || start;
      const newValue = currentValue.slice(0, start) + symbol + currentValue.slice(end);
      setSolutionBlocks(prev => ({
        ...prev,
        [stepOrder]: {
          ...(prev[stepOrder] || {}),
          [field]: newValue,
        },
      }));
      // Восстанавливаем фокус и позицию курсора
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + symbol.length, start + symbol.length);
      }, 0);
    } else {
      // Если фокус потерян, просто добавляем в конец
      setSolutionBlocks(prev => ({
        ...prev,
        [stepOrder]: {
          ...(prev[stepOrder] || {}),
          [field]: currentValue + symbol,
        },
      }));
    }
  };

  const handleSaveStep = async (stepOrder, schemaData = null) => {
    const stepType = stepTypes[stepOrder] || "text";
    const content = stepContents[stepOrder] || "";
    const schema = schemaData || stepSchemas[stepOrder] || {};
    const symbolList = symbolPairs[stepOrder] || [];
    const solutionBlock = solutionBlocks[stepOrder] || {};
    
    if ((stepType === "text" || stepType === "text_pick") && !content.trim()) {
      alert("Введите результат выполнения шага");
      return;
    }
    if (stepType === "symbol") {
      if (!symbolList.length) {
        alert("Добавьте хотя бы одну величину: выберите фрагмент текста, задайте обозначение и нажмите «Добавить»");
        return;
      }
    }
    if (stepType === "boolean") {
      if (!content.trim()) {
        alert("Выберите правильный ответ для шага (Да или Нет)");
        return;
      }
    }
    if (stepType === "solution") {
      if (!solutionBlock.formula?.trim()) {
        alert("Заполните пункт а) Формула для расчёта искомой величины");
        return;
      }
      if (!solutionBlock.calc?.trim()) {
        alert("Заполните пункт в) Подстановка и расчёт");
        return;
      }
      // В content для solution будем класть строку с расчётом (для возможной проверки в будущем)
      if (!stepContents[stepOrder]) {
        stepContents[stepOrder] = solutionBlock.calc;
      }
    }
    if (stepType === "schema" && (!schema.elements || schema.elements.length === 0)) {
      alert("Нарисуйте схему для этого шага");
      return;
    }

    setSaving(true);
    try {
      const step = methodSteps.find(s => s.order === stepOrder);
      if (!step || !step.id) {
        alert("Ошибка: шаг не найден");
        return;
      }

      const existing = solutionSteps[stepOrder];
      const url = existing && existing.id 
        ? `/api/teacher/task-solution-steps/${existing.id}/`
        : "/api/teacher/task-solution-steps/";
      const method = existing && existing.id ? "PATCH" : "POST";

      // Для схем используем JSON body, для текста - FormData (на случай, если будут изображения)
      let requestBody;
      let headers = {
        "X-CSRFToken": getCSRFCookie(),
      };

      if (stepType === "schema") {
        // Для схемы отправляем JSON
        headers["Content-Type"] = "application/json";
        requestBody = JSON.stringify({
          task: parseInt(taskId),
          step: step.id,
          step_type: "schema",
          content: content || "",
          schema_data: schema,
        });
      } else {
        // Для текста используем FormData (на случай будущих изображений)
        const formData = new FormData();
        formData.append("task", taskId);
        formData.append("step", step.id);
        formData.append("step_type", stepType);
        formData.append("content", content);
        // Для типа symbol сохраняем список пар (фрагмент + символ) в schema_data
        if (stepType === "symbol" && symbolList.length) {
          formData.append("schema_data", JSON.stringify({ items: symbolList }));
        } else if (stepType === "solution") {
          formData.append(
            "schema_data",
            JSON.stringify({
              formula: solutionBlock.formula || "",
              si: solutionBlock.si || "",
              calc: solutionBlock.calc || "",
              reasoning: solutionBlock.reasoning || "",
            })
          );
        } else {
          formData.append("schema_data", JSON.stringify({}));
        }
        requestBody = formData;
        // Не устанавливаем Content-Type для FormData - браузер сделает это сам
      }

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: requestBody,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Неизвестная ошибка" }));
        const errorMessage = errorData.detail || errorData.message || JSON.stringify(errorData);
        throw new Error(errorMessage);
      }
      
      const savedData = await res.json();
      
      // Если это последний шаг со схемой - сохраняем финальную схему как эталонную
      const sortedSteps = [...methodSteps].sort((a, b) => a.order - b.order);
      const lastStep = sortedSteps[sortedSteps.length - 1];
      if (stepOrder === lastStep.order && stepType === "schema") {
        await api(`/api/teacher/tasks/${taskId}/save_schema/`, {
          method: "POST",
          body: JSON.stringify({
            data: schema,
            template_type: "reference",
            name: `Эталонная схема (из шага ${stepOrder})`,
          }),
        });
      }

      await loadData();
      setEditingSchemaStep(null);
      alert("Эталонное решение сохранено!");
    } catch (e) {
      alert("Ошибка сохранения: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSchemaSave = async (stepOrder, schemaData) => {
    setStepSchemas({ ...stepSchemas, [stepOrder]: schemaData });
    await handleSaveStep(stepOrder, schemaData);
  };

  // Разбиваем текст задачи на токены, как в интерфейсе ученика
  const tokenizeSelectableText = (text) =>
    (text || "").split(/(\s+)/).map((part, index) => ({
      id: index,
      text: part,
      clean: part.replace(/[.,!?;:(){}"]/g, "").replaceAll("[", "").replaceAll("]", "").trim(),
      isSpace: /^\s+$/.test(part),
    }));

  const handleTextPickToggle = (stepOrder, tokenIndex, tokens) => {
    const current = textPickSelections[stepOrder] || [];
    const next = current.includes(tokenIndex)
      ? current.filter((idx) => idx !== tokenIndex)
      : [...current, tokenIndex].sort((a, b) => a - b);

    setTextPickSelections({
      ...textPickSelections,
      [stepOrder]: next,
    });

    const selectedText = next
      .map((idx) => tokens[idx]?.clean || "")
      .filter(Boolean)
      .join(" ")
      .trim();

    setStepContents({
      ...stepContents,
      [stepOrder]: selectedText,
    });
  };

  const handleSymbolFragmentToggle = (stepOrder, tokenIndex, tokens) => {
    const current = symbolSelections[stepOrder] || [];
    const next = current.includes(tokenIndex)
      ? current.filter((idx) => idx !== tokenIndex)
      : [...current, tokenIndex].sort((a, b) => a - b);

    setSymbolSelections({
      ...symbolSelections,
      [stepOrder]: next,
    });

    const fragment = next
      .map((idx) => tokens[idx]?.clean || "")
      .filter(Boolean)
      .join(" ")
      .trim();

    setSymbolDrafts(prev => ({
      ...prev,
      [stepOrder]: {
        ...(prev[stepOrder] || {}),
        fragment,
      },
    }));
  };

  const handleAddSymbolPair = (stepOrder) => {
    const draft = symbolDrafts[stepOrder] || {};
    const fragment = (draft.fragment || "").trim();
    const symbol = (draft.symbol || "").trim();

    if (!fragment) {
      alert("Сначала выберите фрагмент текста задачи для величины");
      return;
    }
    if (!symbol) {
      alert("Введите обозначение величины (например, S, v, t)");
      return;
    }

    setSymbolPairs(prev => ({
      ...prev,
      [stepOrder]: [...(prev[stepOrder] || []), { fragment, symbol, isTarget: false }],
    }));

    // Очищаем черновик и выделение
    setSymbolDrafts(prev => ({
      ...prev,
      [stepOrder]: { fragment: "", symbol: "" },
    }));
    setSymbolSelections(prev => ({
      ...prev,
      [stepOrder]: [],
    }));
  };

  if (loading) {
    return (
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
        <div className="text-center text-slate-600">Загрузка шагов метода...</div>
      </div>
    );
  }

  if (methodSteps.length === 0) {
    return (
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <p className="text-yellow-800">
          ⚠️ Для этой Системы Знаний не задан метод решения. Сначала создайте метод решения в редакторе СК.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-indigo-50">
        <h3 className="font-bold text-indigo-900">👣 Эталонные решения по шагам (для пооперационного контроля)</h3>
        <p className="text-sm text-indigo-700 mt-1">
          Для каждого шага метода решения укажите эталонный результат выполнения этого шага для данной задачи
        </p>
      </div>

      <div className="divide-y divide-slate-200">
        {methodSteps.map((step) => {
          const stepOrder = step.order;
          const content = stepContents[stepOrder] || "";
          const stepType = stepTypes[stepOrder] || "text";
          const isTextPick = stepType === "text_pick";
          const isSymbol = stepType === "symbol";
          const isBoolean = stepType === "boolean";
          const isSolution = stepType === "solution";
          const tokens = (isTextPick || isSymbol) ? tokenizeSelectableText(taskText) : [];

          return (
            <div key={stepOrder} className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  {stepOrder}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 mb-1">{step.title}</h4>
                  {step.description && (
                    <p className="text-sm text-slate-600 mb-2">{step.description}</p>
                  )}
                </div>
              </div>

              <div className="ml-14 space-y-4">
                {/* Выбор типа шага */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Тип шага:
                  </label>
                  <select
                    value={stepTypes[stepOrder] || "text"}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setStepTypes({ ...stepTypes, [stepOrder]: newType });
                      // Если переключаемся на схему и нет данных - берем из предыдущего шага
                      if (newType === "schema" && !stepSchemas[stepOrder]) {
                        const prevSchema = getPreviousStepSchema(stepOrder);
                        if (prevSchema) {
                          setStepSchemas({ ...stepSchemas, [stepOrder]: prevSchema });
                        } else {
                          setStepSchemas({ ...stepSchemas, [stepOrder]: { width: 800, height: 600, elements: [] } });
                        }
                      }
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="text">📝 Текстовый ответ</option>
                    <option value="text_pick">🔎 Выбор ответа из текста</option>
                    <option value="symbol">∑ Обозначение величины (из текста)</option>
                    <option value="boolean">✅ Ответ да/нет</option>
                    <option value="schema">📐 Схема (рисование)</option>
                    <option value="solution">📋 Блок решения (формула, СИ, расчёт, оценка)</option>
                  </select>
                </div>

                {/* Ввод / выбор для текстовых шагов */}
                {((stepType === "text") || (stepType === "text_pick") || !stepType) && (
                  <div className="space-y-3">
                    {isTextPick && (
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-500 mb-2">
                          Нажмите на слова в условии задачи, которые должны быть правильным ответом для ученика.
                        </div>
                        {taskText ? (
                          <div className="leading-7 text-slate-800">
                            {tokens.map((token) => {
                              if (token.isSpace) {
                                return <span key={token.id}>{token.text}</span>;
                              }
                              const selectedIds = textPickSelections[stepOrder] || [];
                              const isSelected = selectedIds.includes(token.id);
                              return (
                                <button
                                  key={token.id}
                                  type="button"
                                  onClick={() => handleTextPickToggle(stepOrder, token.id, tokens)}
                                  className={`mx-[2px] inline px-1 py-0.5 rounded text-sm transition-colors ${
                                    isSelected ? "bg-indigo-600 text-white" : "hover:bg-indigo-100"
                                  }`}
                                >
                                  {token.text}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic">
                            Текст задачи не загружен. Убедитесь, что задача сохранена, или введите правильный ответ вручную ниже.
                          </div>
                        )}
                        <div className="mt-2 text-xs text-slate-600">
                          Выбранный ответ:{" "}
                          <span className="font-medium text-slate-900">
                            {content || "пока ничего не выбрано"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Результат выполнения этого шага:
                      </label>
                      <textarea
                        value={content}
                        onChange={(e) => setStepContents({ ...stepContents, [stepOrder]: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm"
                        placeholder={stepTypes[stepOrder] === "text_pick"
                          ? "Правильный ответ, который должен получиться при выборе слов из текста задачи"
                          : "Опишите результат выполнения этого шага для данной задачи..."}
                      />
                    </div>
                  </div>
                )}

                {/* Шаг: выбор величины из текста и её обозначения */}
                {isSymbol && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                      <div className="text-xs text-amber-700 mb-2">
                        Нажмите на слова в условии задачи, которые описывают величину (например, «путь», «скорость
                        тела»). Затем задайте её обозначение (S, v, t и т.п.).
                      </div>
                      {taskText ? (
                        <div className="leading-7 text-slate-800">
                          {tokens.map((token) => {
                            if (token.isSpace) {
                              return <span key={token.id}>{token.text}</span>;
                            }
                            const selectedIds = symbolSelections[stepOrder] || [];
                            const isSelected = selectedIds.includes(token.id);
                            return (
                              <button
                                key={token.id}
                                type="button"
                                onClick={() => handleSymbolFragmentToggle(stepOrder, token.id, tokens)}
                                className={`mx-[2px] inline px-1 py-0.5 rounded text-sm transition-colors ${
                                  isSelected ? "bg-amber-500 text-white" : "hover:bg-amber-100"
                                }`}
                              >
                                {token.text}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">
                          Текст задачи не загружен. Убедитесь, что задача сохранена.
                        </div>
                      )}
                      <div className="mt-2 text-xs text-slate-600">
                        Выбранный фрагмент:{" "}
                        <span className="font-medium text-slate-900">
                          {(symbolDrafts[stepOrder]?.fragment || "").trim() || "пока ничего не выбрано"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Обозначение величины (Дано):
                      </label>
                      <div className="flex flex-col md:flex-row gap-2">
                        <input
                          type="text"
                          value={symbolDrafts[stepOrder]?.symbol || ""}
                          onChange={(e) =>
                            setSymbolDrafts(prev => ({
                              ...prev,
                              [stepOrder]: {
                                ...(prev[stepOrder] || {}),
                                symbol: e.target.value.replace(/[^A-Za-z0-9_]/g, ""),
                              },
                            }))
                          }
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg font-mono"
                          placeholder="Например: S, v, t1, v_sr"
                        />
                        {/* Мини-клавиатура символов */}
                        <div className="flex flex-wrap gap-1">
                          {["S", "v", "t", "x", "a", "m", "F", "T", "v_sr"].map((sym) => (
                            <button
                              key={sym}
                              type="button"
                              onClick={() =>
                                setSymbolDrafts(prev => {
                                  const current = (prev[stepOrder]?.symbol || "");
                                  const next = (current + sym).replace(/[^A-Za-z0-9_]/g, "");
                                  return {
                                    ...prev,
                                    [stepOrder]: {
                                      ...(prev[stepOrder] || {}),
                                      symbol: next,
                                    },
                                  };
                                })
                              }
                              className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded font-mono"
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleAddSymbolPair(stepOrder)}
                          className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                        >
                          Добавить величину
                        </button>
                      </div>
                    </div>

                    {symbolPairs[stepOrder] && symbolPairs[stepOrder].length > 0 && (
                      <div className="mt-2 border border-slate-200 rounded-lg p-3 bg-white/70">
                        <div className="text-xs font-medium text-slate-700 mb-1">
                          Добавленные величины (краткая запись «Дано»):
                        </div>
                        <ul className="space-y-1 text-xs text-slate-700">
                          {symbolPairs[stepOrder].map((p, idx) => (
                            <li key={idx} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="radio"
                                  name={`symbol-target-${stepOrder}`}
                                  checked={!!p.isTarget}
                                  onChange={() =>
                                    setSymbolPairs(prev => ({
                                      ...prev,
                                      [stepOrder]: prev[stepOrder].map((item, i) => ({
                                        ...item,
                                        isTarget: i === idx,
                                      })),
                                    }))
                                  }
                                  className="h-3 w-3 text-emerald-600 border-slate-300"
                                />
                                <span>
                                  <span className="font-mono">{p.symbol}</span>{" "}
                                  — {p.fragment}
                                  {p.isTarget && (
                                    <span className="ml-1 inline-flex px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] align-middle">
                                      искомая
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSymbolPairs(prev => ({
                                      ...prev,
                                      [stepOrder]: prev[stepOrder].filter((_, i) => i !== idx),
                                    }))
                                  }
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  Удалить
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Шаг: ответ да/нет */}
                {isBoolean && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                      <p className="text-xs text-emerald-800">
                        Укажите, какой ответ («Да» или «Нет») считается правильным на этом шаге. В пооперационном
                        контроле ученик увидит две кнопки и выберет одну из них.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Правильный ответ:
                      </label>
                      <div className="flex items-center gap-4 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`boolean-${stepOrder}`}
                            checked={content === "yes"}
                            onChange={() =>
                              setStepContents({
                                ...stepContents,
                                [stepOrder]: "yes",
                              })
                            }
                          />
                          <span>Да</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`boolean-${stepOrder}`}
                            checked={content === "no"}
                            onChange={() =>
                              setStepContents({
                                ...stepContents,
                                [stepOrder]: "no",
                              })
                            }
                          />
                          <span>Нет</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Шаг: блок решения (формула, СИ, расчёт, оценка) */}
                {isSolution && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                      <p className="text-xs text-blue-800">
                        Заполните решение так, как вы бы оформили его в тетради. Ученику потом покажем такой же
                        шаблон: формула, переход к СИ, подстановка и расчёт, оценка результата.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          а) Формула для расчёта искомой величины
                        </label>
                        <input
                          type="text"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono"
                          placeholder="Например: S = v · t"
                          value={solutionBlocks[stepOrder]?.formula || ""}
                          onChange={(e) =>
                            setSolutionBlocks(prev => ({
                              ...prev,
                              [stepOrder]: {
                                ...(prev[stepOrder] || {}),
                                formula: e.target.value,
                              },
                            }))
                          }
                          onFocus={() => setActiveFormulaInput({ stepOrder, field: "formula" })}
                        />
                        {/* Мини-клавиатура для формулы */}
                        <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex flex-wrap gap-1">
                            {[
                              { sym: "·", label: "·" },
                              { sym: "×", label: "×" },
                              { sym: "÷", label: "÷" },
                              { sym: "±", label: "±" },
                              { sym: "²", label: "²" },
                              { sym: "³", label: "³" },
                              { sym: "₁", label: "₁" },
                              { sym: "₂", label: "₂" },
                              { sym: "₃", label: "₃" },
                              { sym: "α", label: "α" },
                              { sym: "β", label: "β" },
                              { sym: "π", label: "π" },
                              { sym: "Δ", label: "Δ" },
                              { sym: "⁄", label: "⁄" },
                              { sym: "≈", label: "≈" },
                            ].map(({ sym, label }) => (
                              <button
                                key={sym}
                                type="button"
                                onClick={() => insertSymbol(sym, stepOrder, "formula")}
                                className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-400 font-mono"
                                title={`Вставить ${label}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          б) Переход к единицам СИ
                        </label>
                        <textarea
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                          rows={3}
                          placeholder={"v = 60 км/ч = 16,67 м/с\nt = 20 мин = 1200 с"}
                          value={solutionBlocks[stepOrder]?.si || ""}
                          onChange={(e) =>
                            setSolutionBlocks(prev => ({
                              ...prev,
                              [stepOrder]: {
                                ...(prev[stepOrder] || {}),
                                si: e.target.value,
                              },
                            }))
                          }
                          onFocus={() => setActiveFormulaInput({ stepOrder, field: "si" })}
                        />
                        {/* Мини-клавиатура для СИ */}
                        <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex flex-wrap gap-1">
                            {[
                              { sym: "·", label: "·" },
                              { sym: "×", label: "×" },
                              { sym: "÷", label: "÷" },
                              { sym: "₁", label: "₁" },
                              { sym: "₂", label: "₂" },
                              { sym: "₃", label: "₃" },
                              { sym: "²", label: "²" },
                              { sym: "³", label: "³" },
                              { sym: "⁄", label: "⁄" },
                            ].map(({ sym, label }) => (
                              <button
                                key={sym}
                                type="button"
                                onClick={() => insertSymbol(sym, stepOrder, "si")}
                                className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-400 font-mono"
                                title={`Вставить ${label}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          в) Подстановка и расчёт
                        </label>
                        <textarea
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                          rows={3}
                          placeholder={"S = 16,67 · 1200 = 20004 м = 20 км"}
                          value={solutionBlocks[stepOrder]?.calc || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setSolutionBlocks(prev => ({
                              ...prev,
                              [stepOrder]: {
                                ...(prev[stepOrder] || {}),
                                calc: value,
                              },
                            }));
                            setStepContents({
                              ...stepContents,
                              [stepOrder]: value,
                            });
                          }}
                          onFocus={() => setActiveFormulaInput({ stepOrder, field: "calc" })}
                        />
                        {/* Мини-клавиатура для расчёта */}
                        <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex flex-wrap gap-1">
                            {[
                              { sym: "·", label: "·" },
                              { sym: "×", label: "×" },
                              { sym: "÷", label: "÷" },
                              { sym: "±", label: "±" },
                              { sym: "≈", label: "≈" },
                              { sym: "₁", label: "₁" },
                              { sym: "₂", label: "₂" },
                              { sym: "₃", label: "₃" },
                              { sym: "²", label: "²" },
                              { sym: "³", label: "³" },
                            ].map(({ sym, label }) => (
                              <button
                                key={sym}
                                type="button"
                                onClick={() => insertSymbol(sym, stepOrder, "calc")}
                                className="px-2 py-1 text-sm bg-white border border-slate-300 rounded hover:bg-blue-50 hover:border-blue-400 font-mono"
                                title={`Вставить ${label}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          г) Оценка результата
                        </label>
                        <textarea
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm"
                          rows={2}
                          placeholder="Кратко объясните, почему результат выглядит разумным"
                          value={solutionBlocks[stepOrder]?.reasoning || ""}
                          onChange={(e) =>
                            setSolutionBlocks(prev => ({
                              ...prev,
                              [stepOrder]: {
                                ...(prev[stepOrder] || {}),
                                reasoning: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Редактор схемы */}
                {stepTypes[stepOrder] === "schema" && (
                  <div>
                    <div className="mb-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800">
                        {getPreviousStepSchema(stepOrder) 
                          ? "✓ Схема предыдущего шага загружена. Дорисуйте необходимые элементы."
                          : "Начните рисовать схему с нуля или она будет наследована от предыдущего шага."}
                      </p>
                    </div>
                    {editingSchemaStep === stepOrder ? (
                      <div className="border-2 border-indigo-300 rounded-lg p-4 bg-slate-50">
                        <Suspense fallback={<div className="p-8 text-center">Загрузка редактора...</div>}>
                          <SchemaEditor
                            initialData={stepSchemas[stepOrder] || getPreviousStepSchema(stepOrder) || { width: 800, height: 600, elements: [] }}
                            isTeacher={true}
                            onSave={(data) => handleSchemaSave(stepOrder, data)}
                            onExport={() => {}}
                          />
                        </Suspense>
                        <button
                          onClick={() => setEditingSchemaStep(null)}
                          className="mt-4 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm"
                        >
                          Закрыть редактор
                        </button>
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={() => setEditingSchemaStep(stepOrder)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                        >
                          {stepSchemas[stepOrder] ? "✏️ Редактировать схему" : "📐 Начать рисовать схему"}
                        </button>
                        {stepSchemas[stepOrder] && (
                          <p className="text-xs text-slate-500 mt-2">
                            Схема сохранена ({stepSchemas[stepOrder].elements?.length || 0} элементов)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Кнопка сохранения */}
                <button
                  onClick={() => handleSaveStep(stepOrder)}
                  disabled={
                    saving || 
                    (((stepTypes[stepOrder] === "text") || (stepTypes[stepOrder] === "text_pick") || !stepTypes[stepOrder]) && !content.trim()) ||
                    (stepTypes[stepOrder] === "schema" && !stepSchemas[stepOrder] && editingSchemaStep !== stepOrder)
                  }
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
                >
                  {saving ? "Сохранение..." : "Сохранить эталонное решение"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// ELEMENTS VIEW (старое)
// =============================================================================

function ElementsView() {
  const [categories, setCategories] = useState([]);
  const [showCreator, setShowCreator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadElements();
  }, []);

  const loadElements = async () => {
    try {
      const data = await api("/api/schema-elements/grouped/");
      setCategories(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Элементы схем</h2>
        <button
          onClick={() => setShowCreator(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Создать элемент
        </button>
      </div>

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.slug} className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4">{cat.icon} {cat.name}</h3>
            <div className="grid grid-cols-4 gap-4">
              {cat.elements.map((el) => (
                <div key={el.id} className="p-3 border border-slate-200 rounded-lg">
                  <div
                    className="w-8 h-8 mb-2"
                    dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24">${el.svg_icon}</svg>` }}
                  />
                  <p className="text-sm font-medium">{el.name}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Suspense fallback={<div className="bg-white rounded-xl p-8">Загрузка...</div>}>
            <ElementCreatorVisual
              categories={categories}
              onSave={() => { setShowCreator(false); loadElements(); }}
              onCancel={() => setShowCreator(false)}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}


// =============================================================================
// MODALS
// =============================================================================

function SectionModal({ classes, item, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    school_class: item?.school_class || "",
    title: item?.title || "",
    order: item?.order || 1,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.school_class || !formData.title) {
      alert("Заполните все поля");
      return;
    }
    setSaving(true);
    try {
      if (item?.id) {
        await api(`/api/teacher/sections/${item.id}/`, { method: "PATCH", body: JSON.stringify(formData) });
      } else {
        await api("/api/teacher/sections/", { method: "POST", body: JSON.stringify(formData) });
      }
      onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={item ? "Редактировать раздел" : "Новый раздел"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Класс</label>
          <select
            value={formData.school_class}
            onChange={(e) => setFormData({ ...formData, school_class: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">Выберите...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Порядок</label>
          <input
            type="number"
            value={formData.order}
            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function TopicModal({ sections, item, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    section: item?.section || "",
    title: item?.title || "",
    order: item?.order || 1,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.section || !formData.title) {
      alert("Заполните все поля");
      return;
    }
    setSaving(true);
    try {
      if (item?.id) {
        await api(`/api/teacher/topics/${item.id}/`, { method: "PATCH", body: JSON.stringify(formData) });
      } else {
        await api("/api/teacher/topics/", { method: "POST", body: JSON.stringify(formData) });
      }
      onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={item ? "Редактировать тему" : "Новая тема"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Раздел</label>
          <select
            value={formData.section}
            onChange={(e) => setFormData({ ...formData, section: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">Выберите...</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Порядок</label>
          <input
            type="number"
            value={formData.order}
            onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function KSModal({ topics, item, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    topic: item?.topic || "",
    title: item?.title || "",
    description: item?.description || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.topic || !formData.title) {
      alert("Заполните все поля");
      return;
    }
    setSaving(true);
    try {
      if (item?.id) {
        await api(`/api/teacher/ks-full/${item.id}/`, { method: "PATCH", body: JSON.stringify(formData) });
      } else {
        await api("/api/teacher/ks-full/", { method: "POST", body: JSON.stringify(formData) });
      }
      onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={item ? "Редактировать" : "Новая Система Знаний"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Тема</label>
          <select
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          >
            <option value="">Выберите...</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}


// =============================================================================
// SCREENS
// =============================================================================

function PilotDashboardView({ onGoReviews }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api("/api/teacher/pilot-dashboard/");
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openSession = async (sessionId) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(sessionId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await api(`/api/teacher/pilot-sessions/${sessionId}/`);
      setDetail(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const pending = data?.pending_final_reviews || [];
  const groups = data?.groups || [];

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Апробация ЭОР</h2>
        <p className="text-slate-600 text-sm leading-relaxed max-w-3xl">
          Здесь видны ваши фокус-группы и очередь итоговых работ учеников. Если у вас созданы группы в разделе «Классы и ученики»,
          в очереди показываются только ученики из этих групп; если групп нет — все ожидающие проверки по системе.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <button type="button" onClick={() => load()} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">
            Обновить
          </button>
          <button type="button" onClick={onGoReviews} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
            Открыть проверку итоговых работ
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 mb-3">Мои группы</h3>
              {groups.length === 0 ? (
                <p className="text-sm text-slate-500">Групп пока нет — создайте в «Классы и ученики».</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {groups.map((g) => (
                    <li key={g.id} className="flex justify-between border-b border-slate-100 py-2">
                      <span className="font-medium text-slate-800">{g.title}</span>
                      <span className="text-slate-500">{g.member_count} уч.</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={onGoReviews}
              className="bg-amber-50 rounded-xl border border-amber-200 p-5 text-left hover:bg-amber-100 transition-colors w-full"
            >
              <h3 className="font-bold text-amber-950 mb-2">Очередь проверки</h3>
              <p className="text-3xl font-extrabold text-amber-900">{pending.length}</p>
              <p className="text-sm text-amber-900/80 mt-1">работ ожидают проверки</p>
              {pending.length > 0 && (
                <p className="text-xs font-semibold text-indigo-600 mt-2 underline">Нажмите, чтобы перейти →</p>
              )}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 mb-3">Последние работы из очереди</h3>
            {pending.length === 0 ? (
              <p className="text-slate-500 text-sm">Всё проверено или ученики ещё не отправили итоговые ответы.</p>
            ) : (
              <div className="space-y-3">
                {pending.map((row) => (
                  <div key={row.attempt_id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span>
                        <strong>{row.student}</strong> · {row.ks_title}
                      </span>
                      <span className="text-slate-500">{row.created_at}</span>
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-sm text-indigo-600 font-medium hover:underline"
                      onClick={() => openSession(row.session_id)}
                    >
                      {expandedId === row.session_id ? "Свернуть сессию" : "Смотреть сессию ученика"}
                    </button>
                    {expandedId === row.session_id && (
                      <div className="mt-3 text-sm text-slate-700 border-t border-slate-100 pt-3">
                        {detailLoading && <p>Загрузка…</p>}
                        {!detailLoading && detail && (
                          <div className="space-y-2">
                            <p>
                              Автооценка по задачам: <strong>{detail.score_percent}%</strong>
                              {detail.mastery_percent != null && (
                                <>
                                  {" "}
                                  · Итог усвоения: <strong>{detail.mastery_percent}%</strong>
                                </>
                              )}
                            </p>
                            <p>
                              Задач решено: {detail.tasks_solved_count} / цель {detail.target_tasks_count} · зачёт:{" "}
                              {detail.passed ? "да" : "нет"}
                            </p>
                            <p className="text-xs text-slate-500">
                              События (срез):{" "}
                              {(detail.event_counts || []).map((e) => `${e.event}: ${e.c}`).join(" · ") || "—"}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PilotOrganizerView() {
  const [catalog, setCatalog] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selGroup, setSelGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [addTargetGroup, setAddTargetGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [letter, setLetter] = useState("");
  const [schoolClassId, setSchoolClassId] = useState("");
  const [stuUser, setStuUser] = useState("");
  const [stuPass, setStuPass] = useState("");
  const [stuFirst, setStuFirst] = useState("");
  const [stuLast, setStuLast] = useState("");
  const [stuMode, setStuMode] = useState("student");
  const [studentCard, setStudentCard] = useState(null);
  const [studentCardLoading, setStudentCardLoading] = useState(false);

  const loadGroups = useCallback(async () => {
    setError("");
    try {
      const g = await api("/api/organizer/study-groups/");
      setGroups(Array.isArray(g) ? g : []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const c = await api("/api/catalog/");
      setCatalog(Array.isArray(c) ? c : []);
    } catch {
      setCatalog([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadCatalog();
      await loadGroups();
      setLoading(false);
    })();
  }, [loadCatalog, loadGroups]);

  const loadMembers = async (gid) => {
    setError("");
    try {
      const m = await api(`/api/organizer/study-groups/${gid}/members/`);
      setMembers(Array.isArray(m) ? m : []);
    } catch (e) {
      setError(e.message);
    }
  };

  const createGroup = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/api/organizer/study-groups/", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          letter: letter.trim(),
          school_class: schoolClassId ? Number(schoolClassId) : null,
        }),
      });
      setTitle("");
      setLetter("");
      setSchoolClassId("");
      await loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const addStudent = async (e) => {
    e.preventDefault();
    if (!addTargetGroup) return;
    setError("");
    try {
      await api(`/api/organizer/study-groups/${addTargetGroup}/add_student/`, {
        method: "POST",
        body: JSON.stringify({
          username: stuUser.trim(),
          password: stuPass,
          first_name: stuFirst.trim(),
          last_name: stuLast.trim(),
          student_mode: stuMode,
        }),
      });
      setStuUser("");
      setStuPass("");
      setStuFirst("");
      setStuLast("");
      setStuMode("student");
      await loadMembers(addTargetGroup);
      await loadGroups();
      setAddTargetGroup(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const openStudentCard = async (groupId, userId) => {
    setStudentCardLoading(true);
    setStudentCard(null);
    try {
      const data = await api(`/api/organizer/study-groups/${groupId}/student_card/?user_id=${userId}`);
      setStudentCard({ ...data, group_id: groupId });
    } catch (e) {
      setError(e.message);
    } finally {
      setStudentCardLoading(false);
    }
  };

  const saveStudentCard = async () => {
    if (!studentCard) return;
    setStudentCardLoading(true);
    setError("");
    try {
      await api(`/api/organizer/study-groups/${studentCard.group_id}/update_student/`, {
        method: "PATCH",
        body: JSON.stringify({
          user_id: studentCard.user_id,
          first_name: studentCard.first_name || "",
          last_name: studentCard.last_name || "",
          must_change_password: !!studentCard.must_change_password,
          student_mode: studentCard.student_mode || "student",
        }),
      });
      if (selGroup) await loadMembers(selGroup);
      setStudentCard(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setStudentCardLoading(false);
    }
  };

  const clearStudentData = async () => {
    if (!studentCard) return;
    if (!confirm("Удалить все учебные данные этого ученика по системам знаний?")) return;
    setStudentCardLoading(true);
    setError("");
    try {
      await api(`/api/organizer/study-groups/${studentCard.group_id}/update_student/`, {
        method: "PATCH",
        body: JSON.stringify({
          user_id: studentCard.user_id,
          clear_learning_data: true,
        }),
      });
      const data = await api(`/api/organizer/study-groups/${studentCard.group_id}/student_card/?user_id=${studentCard.user_id}`);
      setStudentCard({ ...data, group_id: studentCard.group_id });
    } catch (e) {
      setError(e.message);
    } finally {
      setStudentCardLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Новая группа (класс + буква)</h2>
        <p className="text-sm text-slate-600 mb-4">
          Ученики заходят на ту же страницу <span className="font-mono text-xs">/app/</span> под своим логином и
          паролем. После первого входа система может попросить сменить пароль.
        </p>
        <form onSubmit={createGroup} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Название группы</label>
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: 7 А — фокус-группа"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Буква класса</label>
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              placeholder="А"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Параллель (из курса, необязательно)</label>
            <select
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              value={schoolClassId}
              onChange={(e) => setSchoolClassId(e.target.value)}
            >
              <option value="">— не выбрано —</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
              Создать группу
            </button>
          </div>
        </form>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-3">Группы и ученики</h3>
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="border border-slate-200 rounded-lg p-4 flex flex-wrap justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-800">{g.title}</div>
                <div className="text-xs text-slate-500">
                  Буква: {g.letter || "—"} · участников: {g.member_count}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium"
                  onClick={() => {
                    setAddTargetGroup(g.id);
                    setSelGroup(g.id);
                    loadMembers(g.id);
                  }}
                >
                  ＋ Ученик
                </button>
                <button
                  type="button"
                  className="text-sm text-indigo-600 font-medium"
                  onClick={() => {
                    setSelGroup(g.id);
                    loadMembers(g.id);
                  }}
                >
                  Показать учеников
                </button>
              </div>
            </div>
          ))}
        </div>

        {selGroup && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <h4 className="font-semibold mb-2">Ученики выбранной группы</h4>
            <ul className="mt-4 space-y-1 text-sm">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between py-2 border-b border-slate-50">
                  <button
                    type="button"
                    onClick={() => openStudentCard(selGroup, m.user_id)}
                    className="text-left hover:text-indigo-700"
                  >
                    <span className="font-medium">{m.username}</span>
                    {m.first_name ? <span className="ml-2 text-slate-500">{m.first_name}</span> : null}
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      m.student_mode === "pilot" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {m.student_mode === "pilot" ? "апробация" : "ученик"}
                    </span>
                    {m.must_change_password ? (
                      <span className="ml-2 text-amber-600 text-xs">нужна смена пароля</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {addTargetGroup && (
        <div className="fixed inset-0 z-[160] bg-black/45 flex items-center justify-center p-4" onClick={() => setAddTargetGroup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-bold text-slate-900 mb-1">Добавить ученика в группу</h4>
            <p className="text-sm text-slate-500 mb-4">{groups.find((g) => g.id === addTargetGroup)?.title || ""}</p>
            <form onSubmit={addStudent} className="grid sm:grid-cols-2 gap-3">
              <input
                className="px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="Логин (латиница)"
                value={stuUser}
                onChange={(e) => setStuUser(e.target.value)}
                required
              />
              <input
                className="px-3 py-2 border border-slate-300 rounded-lg"
                type="text"
                placeholder="Пароль (выдать ученику)"
                value={stuPass}
                onChange={(e) => setStuPass(e.target.value)}
                autoComplete="new-password"
                required
              />
              <input
                className="px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="Имя (необязательно)"
                value={stuFirst}
                onChange={(e) => setStuFirst(e.target.value)}
              />
              <input
                className="px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="Фамилия (необязательно)"
                value={stuLast}
                onChange={(e) => setStuLast(e.target.value)}
              />
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Режим ученика</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={stuMode}
                  onChange={(e) => setStuMode(e.target.value)}
                >
                  <option value="student">Ученик (без пропуска этапов, без сброса данных)</option>
                  <option value="pilot">Апробация (можно пропускать и очищать данные)</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
                  Добавить ученика
                </button>
                <button type="button" onClick={() => setAddTargetGroup(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(studentCardLoading || studentCard) && (
        <div className="fixed inset-0 z-[170] bg-black/45 flex items-center justify-center p-4" onClick={() => setStudentCard(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-2xl max-h-[88vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            {studentCardLoading && !studentCard ? (
              <p className="text-slate-500">Загрузка карточки ученика…</p>
            ) : studentCard ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">@{studentCard.username}</h4>
                    <p className="text-sm text-slate-500">Карточка ученика</p>
                  </div>
                  <button type="button" onClick={() => setStudentCard(null)} className="text-slate-500 hover:text-slate-800">✕</button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Имя</label>
                    <input
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={studentCard.first_name || ""}
                      onChange={(e) => setStudentCard((prev) => ({ ...prev, first_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Фамилия</label>
                    <input
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={studentCard.last_name || ""}
                      onChange={(e) => setStudentCard((prev) => ({ ...prev, last_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Режим</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={studentCard.student_mode || "student"}
                      onChange={(e) => setStudentCard((prev) => ({ ...prev, student_mode: e.target.value }))}
                    >
                      <option value="student">Ученик</option>
                      <option value="pilot">Апробация</option>
                    </select>
                  </div>
                  <label className="inline-flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      checked={!!studentCard.must_change_password}
                      onChange={(e) => setStudentCard((prev) => ({ ...prev, must_change_password: e.target.checked }))}
                    />
                    <span className="text-sm text-slate-700">Требовать смену пароля при входе</span>
                  </label>
                </div>

                <div>
                  <h5 className="font-semibold text-slate-800 mb-2">Успеваемость ученика</h5>
                  <div className="space-y-2">
                    {(studentCard.sessions || []).map((s) => (
                      <div key={s.session_id} className="rounded-lg border border-slate-200 p-3 text-sm">
                        <div className="font-medium text-slate-800">{s.ks_title}</div>
                        <div className="text-slate-500 mt-1">
                          Этап: {s.current_stage} · Решено: {s.tasks_solved_count} · Верно: {s.tasks_correct_count}
                        </div>
                        <div className="text-slate-500">
                          Авто: {s.score_percent ?? 0}% · Итог: {s.mastery_percent ?? 0}%
                        </div>
                      </div>
                    ))}
                    {!(studentCard.sessions || []).length && (
                      <p className="text-sm text-slate-500">Сессий пока нет.</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={saveStudentCard} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={clearStudentData}
                    disabled={(studentCard.student_mode || "student") !== "pilot"}
                    className="px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm disabled:opacity-40"
                  >
                    Стереть учебные данные
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Карточка одной работы (переиспользуется в Очереди и Архиве)
// ---------------------------------------------------------------------------
function ReviewCard({ row, onRefresh, isArchive }) {
  const [comment, setComment] = useState(row.teacher_comment || "");
  const [grade, setGrade] = useState(row.teacher_grade_2_5 != null ? String(row.teacher_grade_2_5) : "");
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(!isArchive); // очередь — сразу edit; архив — нажать Edit

  const submit = async (newStatus) => {
    if (!grade && newStatus === "accepted") {
      alert("Выберите отметку 2–5 перед тем, как принять работу.");
      return;
    }
    setBusy(true);
    try {
      if (isArchive) {
        await api(`/api/teacher/final-reviews/${row.id}/edit/`, {
          method: "PATCH",
          body: JSON.stringify({
            status: newStatus,
            comment,
            grade_2_5: grade !== "" ? Number(grade) : undefined,
          }),
        });
      } else {
        await api("/api/teacher/final-reviews/submit/", {
          method: "POST",
          body: JSON.stringify({
            attempt_id: row.id,
            status: newStatus,
            comment,
            grade_2_5: grade !== "" ? Number(grade) : undefined,
          }),
        });
      }
      setEditMode(false);
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const autoCheckBadge =
    row.is_correct_auto === true ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
        ✓ автопроверка: верно
      </span>
    ) : row.is_correct_auto === false ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-medium">
        ✗ автопроверка: неверно
      </span>
    ) : null;

  const statusBadge =
    row.teacher_review_status === "accepted" ? (
      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">Принято</span>
    ) : row.teacher_review_status === "rejected" ? (
      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">На доработку</span>
    ) : (
      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">Ожидает</span>
    );

  const images = row.answer_image_urls?.length
    ? row.answer_image_urls
    : row.answer_image_url
    ? [row.answer_image_url]
    : [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <span className="font-semibold text-slate-900">{row.student}</span>
          <span className="text-slate-500 text-sm ml-2">· {row.ks_title}</span>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          {isArchive && !editMode && (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="text-xs text-indigo-600 font-medium hover:underline"
            >
              Изменить оценку
            </button>
          )}
        </div>
      </div>

      {/* Student answer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Ответ ученика</p>
        <p className="text-slate-900 text-base font-medium">
          {row.answer_numeric != null && row.answer_numeric !== ""
            ? String(row.answer_numeric)
            : row.answer_text || "—"}
        </p>
        {autoCheckBadge && <div className="mt-2">{autoCheckBadge}</div>}
        {images.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((url, i) => (
              <a
                key={`${row.id}-img-${i}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg overflow-hidden border border-slate-200 hover:opacity-80"
              >
                <img
                  src={url}
                  alt={`Фото ${i + 1}`}
                  className="h-32 w-auto object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Archive: show existing review summary when not editing */}
      {isArchive && !editMode && row.teacher_grade_2_5 != null && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Оценка учителя</p>
          <p className="text-2xl font-bold text-slate-900">{row.teacher_grade_2_5}</p>
          {row.teacher_comment && (
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{row.teacher_comment}</p>
          )}
        </div>
      )}

      {/* Edit / Submit form */}
      {editMode && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Комментарий учителя</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Необязательно — ученик увидит этот текст"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[68px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Отметка 2–5</label>
            <select
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">— выберите —</option>
              <option value="5">5 — отлично</option>
              <option value="4">4 — хорошо</option>
              <option value="3">3 — удовлетворительно</option>
              <option value="2">2 — неудовлетворительно</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => submit("accepted")}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {busy ? "…" : isArchive ? "Сохранить (принято)" : "Принять работу"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => submit("rejected")}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {busy ? "…" : "На доработку"}
            </button>
            {isArchive && (
              <button
                type="button"
                onClick={() => { setComment(row.teacher_comment || ""); setGrade(row.teacher_grade_2_5 != null ? String(row.teacher_grade_2_5) : ""); setEditMode(false); }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm"
              >
                Отмена
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FinalReviewsView() {
  const [tab, setTab] = useState("pending"); // pending | archive
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const statusParam = tab === "archive" ? "reviewed" : "pending";
      const data = await api(`/api/teacher/final-reviews/?status=${statusParam}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const tabCls = (t) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? "bg-indigo-600 text-white"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-1">Итоговые работы учеников</h2>
        <p className="text-sm text-slate-600 mb-4">
          Финальные ситуации проверяются учителем. Выставите отметку 2–5 — она учитывается в итоговом проценте усвоения.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={tabCls("pending")} onClick={() => setTab("pending")}>
            Очередь {tab === "pending" && items.length > 0 ? `(${items.length})` : ""}
          </button>
          <button type="button" className={tabCls("archive")} onClick={() => setTab("archive")}>
            Архив проверенных
          </button>
          <button type="button" onClick={load} className="ml-auto px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
            Обновить
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? (
        <LoadingScreen />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
          {tab === "pending"
            ? "Очередь пуста — всё проверено или ученики ещё не отправили итоговые ответы."
            : "Проверенных работ пока нет."}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((row) => (
            <ReviewCard key={row.id} row={row} onRefresh={load} isArchive={tab === "archive"} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GRADEBOOK VIEW — Журнал: ученики × СК × оценки
// ---------------------------------------------------------------------------
function GradebookView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api("/api/teacher/final-reviews/gradebook/");
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return null;

  const { students, ks_list, cells } = data;

  const gradeColor = (g) => {
    if (!g) return "text-slate-400";
    if (g >= 5) return "text-emerald-700 font-bold";
    if (g >= 4) return "text-green-700 font-semibold";
    if (g >= 3) return "text-amber-700 font-semibold";
    return "text-red-700 font-semibold";
  };

  const stageBadge = (stage, finalStatus) => {
    if (stage === "completed" && finalStatus === "accepted") return { label: "Зачёт ✓", cls: "bg-emerald-100 text-emerald-800" };
    if (stage === "completed") return { label: "Завершено", cls: "bg-slate-100 text-slate-600" };
    if (finalStatus === "pending") return { label: "На проверке", cls: "bg-blue-100 text-blue-800" };
    if (finalStatus === "rejected") return { label: "На доработке", cls: "bg-amber-100 text-amber-800" };
    return { label: "В процессе", cls: "bg-slate-50 text-slate-500" };
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Журнал оценок</h2>
          <p className="text-sm text-slate-600">
            Ученики × системы знаний. Нажмите на ячейку — откроется детальный отчёт и возможность скорректировать оценку.
          </p>
        </div>
        <button type="button" onClick={load} className="shrink-0 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
          Обновить
        </button>
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
          Нет данных — добавьте учеников в группы в разделе «Классы и ученики».
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 min-w-[160px] sticky left-0 bg-slate-50">
                  Ученик
                </th>
                {ks_list.map((ks) => (
                  <th
                    key={ks.id}
                    className="px-3 py-3 text-center font-semibold text-slate-700 min-w-[130px] max-w-[190px]"
                  >
                    <span className="block truncate text-xs" title={ks.title}>{ks.title}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((stu) => (
                <tr key={stu.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white">
                    {stu.full_name}
                  </td>
                  {ks_list.map((ks) => {
                    const cell = cells[`${stu.id}_${ks.id}`];
                    if (!cell) {
                      return <td key={ks.id} className="px-3 py-3 text-center text-slate-200 text-lg">—</td>;
                    }
                    const badge = stageBadge(cell.current_stage, cell.final_review_status);
                    return (
                      <td key={ks.id} className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedCell({ student: stu, ks, cell })}
                          className="w-full flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-indigo-50 transition-colors"
                        >
                          {cell.grade != null ? (
                            <span className={`text-2xl ${gradeColor(cell.grade)}`}>{cell.grade}</span>
                          ) : (
                            <span className="text-slate-300 text-xl">·</span>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
                            {badge.label}
                          </span>
                          {cell.mastery_percent != null && (
                            <span className="text-xs text-slate-400">{cell.mastery_percent}%</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCell && (
        <GradebookCellModal
          student={selectedCell.student}
          ks={selectedCell.ks}
          cell={selectedCell.cell}
          onClose={() => setSelectedCell(null)}
          onRefresh={() => { setSelectedCell(null); load(); }}
        />
      )}
    </div>
  );
}

function GradebookCellModal({ student, ks, cell, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [grade, setGrade] = useState(cell.grade != null ? String(cell.grade) : "");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingDetail(true);
      try {
        const d = await api(`/api/teacher/pilot-sessions/${cell.session_id}/`);
        setDetail(d);
        if (cell.attempt_id) {
          try {
            const reviews = await api("/api/teacher/final-reviews/?status=reviewed");
            const found = reviews.find((r) => r.id === cell.attempt_id);
            if (found) setComment(found.teacher_comment || "");
          } catch { /* ignore */ }
        }
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [cell.session_id, cell.attempt_id]);

  const saveGrade = async (newStatus) => {
    if (!grade && newStatus === "accepted") { alert("Выберите отметку 2–5"); return; }
    if (!cell.attempt_id) { alert("Нет итоговой попытки для этой сессии."); return; }
    setBusy(true);
    try {
      await api(`/api/teacher/final-reviews/${cell.attempt_id}/edit/`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, comment, grade_2_5: grade !== "" ? Number(grade) : undefined }),
      });
      onRefresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{student.full_name}</h3>
            <p className="text-sm text-slate-500">{ks.title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {err && <p className="text-red-600 text-sm">{err}</p>}

          {loadingDetail ? (
            <p className="text-slate-500 text-sm animate-pulse">Загрузка данных сессии…</p>
          ) : detail ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1 text-sm text-slate-700">
              <p>Автооценка: <strong>{detail.score_percent ?? "—"}%</strong>
                {detail.mastery_percent != null && <> · Усвоение: <strong>{detail.mastery_percent}%</strong></>}
              </p>
              <p>
                Решено: <strong>{detail.tasks_solved_count}</strong> / <strong>{detail.target_tasks_count}</strong> ·
                Верно: <strong>{detail.tasks_correct_count ?? "—"}</strong> ·
                Зачёт: <strong>{detail.passed ? "✓ да" : "✗ нет"}</strong>
              </p>
              {detail.event_counts?.length > 0 && (
                <p className="text-xs text-slate-500 pt-1 border-t border-slate-200 mt-2">
                  События: {detail.event_counts.map((e) => `${e.event}: ${e.c}`).join(" · ")}
                </p>
              )}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Оценка учителя</p>
            {!editMode ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  {cell.grade != null ? (
                    <span className="text-3xl font-bold text-slate-900">{cell.grade}</span>
                  ) : (
                    <span className="text-slate-400 text-sm">Не выставлена</span>
                  )}
                  {comment && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{comment}</p>}
                </div>
                {cell.attempt_id && (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
                  >
                    Изменить
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  <option value="">— выберите отметку —</option>
                  <option value="5">5 — отлично</option>
                  <option value="4">4 — хорошо</option>
                  <option value="3">3 — удовлетворительно</option>
                  <option value="2">2 — неудовлетворительно</option>
                </select>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Комментарий учителю (необязательно)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[60px]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveGrade("accepted")}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {busy ? "…" : "Сохранить (принято)"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveGrade("rejected")}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    На доработку
                  </button>
                  <button type="button" onClick={() => setEditMode(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-lg">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-xl font-semibold mb-2">Ошибка</h2>
        <p className="text-slate-600 mb-6">{message}</p>
        <a
          href="/app/"
          className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Открыть /app/
        </a>
      </div>
    </div>
  );
}
