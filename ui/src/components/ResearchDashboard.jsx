/**
 * ResearchDashboard — панель исследовательской аналитики ЭОР
 * Данные для проверки гипотез ТПФУД и экспериментальной главы выпускной работы.
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Scatter, Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
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
    const err = await res.json().catch(() => ({ detail: "Ошибка сервера" }));
    throw new Error(err.detail || "Ошибка");
  }
  return res.json();
};

// Интерпретация коэффициента Пирсона
function interpretR(r) {
  if (r === null || r === undefined) return { text: "Нет данных", color: "text-slate-500" };
  const abs = Math.abs(r);
  if (abs >= 0.7) return { text: `r = ${r} — сильная корреляция`, color: "text-emerald-700" };
  if (abs >= 0.4) return { text: `r = ${r} — умеренная корреляция`, color: "text-amber-700" };
  if (abs >= 0.2) return { text: `r = ${r} — слабая корреляция`, color: "text-orange-700" };
  return { text: `r = ${r} — нет значимой корреляции`, color: "text-red-700" };
}

const PALETTE = {
  indigo: "#6366f1",
  purple: "#a855f7",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  slate: "#64748b",
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: "index", intersect: false },
  },
};

// ─── Карточки сводки ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "indigo", icon }) {
  const colors = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    rose: "from-rose-500 to-rose-600",
    purple: "from-purple-500 to-purple-600",
    sky: "from-sky-500 to-sky-600",
  };
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-xl flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 leading-tight">
          {value !== null && value !== undefined ? value : "—"}
        </div>
        <div className="text-sm font-medium text-slate-700 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Блок с заголовком ────────────────────────────────────────────────────────

function Block({ number, title, hypothesis, children, interpretation }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-6 py-5 hover:bg-slate-50 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
          {number}
        </span>
        <div className="flex-1">
          <div className="font-semibold text-slate-900 text-base">{title}</div>
          {hypothesis && (
            <div className="text-xs text-slate-500 mt-0.5 italic">{hypothesis}</div>
          )}
        </div>
        <span className="text-slate-400 text-lg">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-6 pb-6 space-y-4">
          {children}
          {interpretation && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-sm text-indigo-900">
              <span className="font-semibold">Интерпретация: </span>{interpretation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Блок 1: Воронка завершения ───────────────────────────────────────────────

function FunnelBlock({ funnel, summary }) {
  if (!funnel || funnel.length === 0) return <EmptyState />;
  const maxCount = funnel[0]?.count || 1;

  return (
    <Block
      number="1"
      title="Динамика прохождения этапов: где учащиеся прерывают работу с ЭОР"
      hypothesis="Описательная статистика: доля добравшихся до конца учебной траектории и «узкие места» на этапах"
      interpretation={`Завершили все этапы ${summary?.completion_rate ?? "—"}% наблюдавшихся траекторий (доля завершивших программу траектории). Этапы с наибольшей потерей учащихся имеет смысл рассмотреть при доработке ЭОР.`}
    >
      <div className="space-y-2">
        {funnel.map((item) => {
          const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          const itemPct = maxCount > 0 ? Math.round(item.count / funnel[0].count * 100) : 0;
          return (
            <div key={item.stage} className="flex items-center gap-3">
              <div className="w-40 text-xs text-slate-600 text-right flex-shrink-0 truncate pr-1">{item.label}</div>
              <div className="flex-1 bg-slate-100 rounded-full h-7 relative overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500 flex items-center"
                  style={{ width: `${pct}%`, minWidth: item.count > 0 ? "2rem" : 0 }}
                >
                  {item.count > 0 && (
                    <span className="text-white text-xs font-semibold pl-2 whitespace-nowrap">
                      {item.count}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-10 text-xs text-slate-400 text-right flex-shrink-0">{itemPct}%</div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
        <div className="text-center">
          <div className="text-xl font-bold text-indigo-600">{summary?.total_sessions ?? "—"}</div>
          <div className="text-xs text-slate-500">Число траекторий</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-emerald-600">{summary?.completed_sessions ?? "—"}</div>
          <div className="text-xs text-slate-500">Завершено</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-amber-600">{summary?.completion_rate ?? "—"}%</div>
          <div className="text-xs text-slate-500">Доля завершивших</div>
        </div>
      </div>
    </Block>
  );
}

// ─── Блок 2: ООД → Усвоение (корреляция) ─────────────────────────────────────

function OODCorrelationBlock({ oodCorrelation, compAttemptsDist }) {
  if (!oodCorrelation) return <EmptyState />;

  const { points, r, n } = oodCorrelation;
  const rInfo = interpretR(r);

  const DIFF_COLORS = {
    easy: "#10b981",
    medium: "#f59e0b",
    hard: "#f43f5e",
    unknown: "#94a3b8",
  };

  const scatterData = {
    datasets: [
      ...["easy", "medium", "hard", "unknown"].map((diff) => {
        const pts = points.filter((p) => p.difficulty === diff);
        const labels = { easy: "Лёгкое", medium: "Непростое", hard: "Трудное", unknown: "нет сведений" };
        return {
          label: labels[diff],
          data: pts.map((p) => ({ x: p.x, y: p.y })),
          backgroundColor: DIFF_COLORS[diff] + "cc",
          pointRadius: 6,
          pointHoverRadius: 8,
        };
      }).filter((d) => d.data.length > 0),
    ],
  };

  const scatterOptions = {
    ...CHART_DEFAULTS,
    plugins: {
      ...CHART_DEFAULTS.plugins,
      legend: { display: true, position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx) => `Осмысление: ${ctx.parsed.x}%, Усвоение: ${ctx.parsed.y}%`,
        },
      },
    },
    scales: {
      x: { title: { display: true, text: "Осмысление СК (%)" }, min: 0, max: 100 },
      y: { title: { display: true, text: "Итоговое усвоение (%)" }, min: 0, max: 100 },
    },
  };

  // Распределение попыток осмысления
  const attemptsData = {
    labels: compAttemptsDist?.map((d) => `${d.label} попытка`) || [],
    datasets: [{
      data: compAttemptsDist?.map((d) => d.count) || [],
      backgroundColor: [PALETTE.emerald + "dd", PALETTE.amber + "dd", PALETTE.rose + "dd"],
      borderWidth: 0,
    }],
  };

  return (
    <Block
      number="2"
      title="Гипотеза 1: Роль ориентировочной основы действия (Гальперин)"
      hypothesis="Гипотеза 1: Качество осмысления СК положительно коррелирует с итоговым усвоением; без достаточно сформированной ООД действие закрепляется хуже."
      interpretation={
        n > 0
          ? `По объёму наблюдений $n$: ${rInfo.text}. ${
              r !== null && r > 0.4
                ? "Гипотеза о роли ООД подтверждается: ученики с высоким уровнем осмысления систематически достигают лучших итоговых результатов."
                : "Требуется больше данных для уверенного вывода."
            }`
          : "Недостаточно данных для анализа."
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Диаграмма рассеяния «осмысление — усвоение»
          </div>
          <div style={{ height: 280 }}>
            {points.length > 0 ? (
              <Scatter data={scatterData} options={scatterOptions} />
            ) : (
              <EmptyState small />
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Попытки осмысления
          </div>
          <div style={{ height: 180 }}>
            {compAttemptsDist?.some((d) => d.count > 0) ? (
              <Doughnut
                data={attemptsData}
                options={{
                  ...CHART_DEFAULTS,
                  plugins: { legend: { display: true, position: "bottom" } },
                }}
              />
            ) : (
              <EmptyState small />
            )}
          </div>
          <div className={`mt-4 text-sm font-semibold ${rInfo.color}`}>{rInfo.text}</div>
          <div className="text-xs text-slate-500 mt-1">Объём выборки (n учебных траекторий с измерением усвоения): {n}</div>
        </div>
      </div>
    </Block>
  );
}

// ─── Блок 3: Адаптивный алгоритм ─────────────────────────────────────────────

function AdaptiveBlock({ masteryByDifficulty, learningPathDist }) {
  const diffEntries = Object.entries(masteryByDifficulty || {});
  const pathEntries = Object.entries(learningPathDist || {});

  const diffLabels = diffEntries.map(([, v]) => v.label);
  const diffMastery = diffEntries.map(([, v]) => v.avg_mastery ?? 0);
  const diffCounts = diffEntries.map(([, v]) => v.count);

  const diffColors = [PALETTE.emerald, PALETTE.amber, PALETTE.rose, PALETTE.slate];

  const diffData = {
    labels: diffLabels,
    datasets: [
      {
        label: "Среднее усвоение (%)",
        data: diffMastery,
        backgroundColor: diffColors.slice(0, diffLabels.length).map((c) => c + "cc"),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const pathColors = [PALETTE.indigo, PALETTE.sky, PALETTE.purple];
  const pathData = {
    labels: pathEntries.map(([, v]) => v.label),
    datasets: [{
      data: pathEntries.map(([, v]) => v.count),
      backgroundColor: pathColors.slice(0, pathEntries.length).map((c) => c + "dd"),
      borderWidth: 0,
    }],
  };

  const totalCounts = diffCounts.reduce((a, b) => a + b, 0);

  return (
    <Block
      number="3"
      title="Гипотеза 2: Работа адаптивного алгоритма"
      hypothesis="Адаптивный алгоритм адекватно направляет учащихся по траекториям так, чтобы итоговые результаты оставались сопоставимыми при разной заявленной трудности."
      interpretation={
        diffEntries.length > 0
          ? (() => {
              const base = `Распределение по траекториям: ${diffEntries.map(([, v]) => `«${v.label}» — ${v.count} учащ.`).join(", ")}.`;
              if (diffMastery.filter(Boolean).length < 2) return base;
              const lo = Math.min(...diffMastery.filter(Boolean));
              const hi = Math.max(...diffMastery.filter(Boolean));
              const spread = Math.round(hi - lo);
              const tail = spread < 15
                ? `Разброс средних долей усвоения между траекториями (${lo}–${hi} %, разность ${spread} п.) укладывается в узкий диапазон — возможна интерпретация в пользу выравнивания итоговых результатов.`
                : `Разброс средних долей усвоения (${lo}–${hi} %, разность ${spread} п.) существенен; возможна необходимость уточнения параметров алгоритма.`;
              return `${base} ${tail}`;
            })()
          : "Нет данных."
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Среднее усвоение по маршруту
          </div>
          <div style={{ height: 220 }}>
            {diffLabels.length > 0 ? (
              <Bar
                data={diffData}
                options={{
                  ...CHART_DEFAULTS,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { min: 0, max: 100, title: { display: true, text: "Усвоение (%)" } },
                    x: {},
                  },
                }}
              />
            ) : <EmptyState small />}
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {diffEntries.map(([key, v], i) => (
              <span key={key} className="text-xs px-2 py-1 rounded-full" style={{ background: diffColors[i] + "22", color: diffColors[i] }}>
                {v.label}: {v.count} учащ.
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Распределение учебных путей
          </div>
          <div style={{ height: 200 }}>
            {pathEntries.length > 0 ? (
              <Doughnut
                data={pathData}
                options={{
                  ...CHART_DEFAULTS,
                  plugins: { legend: { display: true, position: "bottom" } },
                }}
              />
            ) : <EmptyState small />}
          </div>
        </div>
      </div>
    </Block>
  );
}

// ─── Блок 4: Кривая обучения ──────────────────────────────────────────────────

function LearningCurveBlock({ stepLearningCurve, stepDifficulty }) {
  const curve = stepLearningCurve || [];
  const difficulty = stepDifficulty || [];

  const curveData = {
    labels: curve.map((d) => d.label),
    datasets: [
      {
        label: "% верных операций по шагам",
        data: curve.map((d) => d.avg_correct_rate),
        borderColor: PALETTE.emerald,
        backgroundColor: PALETTE.emerald + "22",
        tension: 0.4,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: PALETTE.emerald,
      },
      {
        label: "% обращений к эталону",
        data: curve.map((d) => d.chose_system_rate),
        borderColor: PALETTE.rose,
        backgroundColor: PALETTE.rose + "22",
        tension: 0.4,
        fill: false,
        borderDash: [5, 3],
        pointRadius: 4,
        pointBackgroundColor: PALETTE.rose,
      },
    ],
  };

  const difficultyData = {
    labels: difficulty.map((d) => d.step_title || `Шаг ${d.step_order}`),
    datasets: [{
      label: "Средн. ошибок на шаге",
      data: difficulty.map((d) => d.avg_errors),
      backgroundColor: difficulty.map((d) =>
        d.avg_errors > 1.5 ? PALETTE.rose + "cc" : d.avg_errors > 0.7 ? PALETTE.amber + "cc" : PALETTE.emerald + "cc"
      ),
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const trendText = (() => {
    const rates = curve.map((d) => d.avg_correct_rate).filter(Boolean);
    if (rates.length < 2) return "";
    const first = rates.slice(0, Math.ceil(rates.length / 2));
    const last = rates.slice(Math.floor(rates.length / 2));
    const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
    const avgLast = last.reduce((a, b) => a + b, 0) / last.length;
    const delta = Math.round(avgLast - avgFirst);
    if (delta > 5) return `Рост правильных ответов: +${delta}% от начала к концу сессии — кривая обучения подтверждается.`;
    if (delta < -5) return `Снижение к концу: ${delta}% — возможно, последние задачи сложнее.`;
    return "Стабильный уровень на протяжении сессии.";
  })();

  return (
    <Block
      number="4"
      title="Гипотеза 3: Кривая обучения при пооперационном контроле"
      hypothesis="Гипотеза 3: по мере перехода к следующим задачам возрастает доля успешных шагов решения и снижается доля обращений к эталону — отражает формирование учебного действия при пооперационном контроле."
      interpretation={
        trendText ||
        "Сплошная линия — доля успешных шагов; пунктир — доля случаев, когда учащийся использовал системный эталон вместо самостоятельного ответа."
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Динамика по задачам
          </div>
          <div style={{ height: 240 }}>
            {curve.length > 0 ? (
              <Line
                data={curveData}
                options={{
                  ...CHART_DEFAULTS,
                  plugins: { legend: { display: true, position: "bottom" } },
                  scales: {
                    y: { min: 0, max: 100, title: { display: true, text: "%" } },
                  },
                }}
              />
            ) : <EmptyState small />}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Сложность шагов метода (среднее ошибок)
          </div>
          <div style={{ height: 240 }}>
            {difficulty.length > 0 ? (
              <Bar
                data={difficultyData}
                options={{
                  ...CHART_DEFAULTS,
                  indexAxis: "y",
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { title: { display: true, text: "Среднее кол-во ошибок" } },
                  },
                }}
              />
            ) : <EmptyState small />}
          </div>
          <div className="flex gap-3 mt-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-emerald-500"></span>{"≤ 0.7 — легко"}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-amber-500"></span>{"0.7–1.5 — сложновато"}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-rose-500"></span>{"> 1.5 — проблемный шаг"}</span>
          </div>
        </div>
      </div>
    </Block>
  );
}

// ─── Блок 5: Сравнительный анализ pre/post ────────────────────────────────────

function ComparisonBlock({ externalTests, gainScores, groups, onAddResult, onDeleteResult, busy }) {
  const [form, setForm] = useState({
    group_type: "control",
    test_type: "pre",
    participant_code: "",
    score_percent: "",
    correct_tasks: "",
    max_tasks: "5",
    study_group_id: "",
  });
  const [addErr, setAddErr] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddErr("");
    if (!form.score_percent) { setAddErr("Укажите результат (%)"); return; }
    await onAddResult(form);
    setForm((f) => ({ ...f, participant_code: "", score_percent: "", correct_tasks: "" }));
  };

  const OGE_BENCHMARK_LOW = 23;
  const OGE_BENCHMARK_HIGH = 53;
  const OGE_BENCHMARK_MID = Math.round((OGE_BENCHMARK_LOW + OGE_BENCHMARK_HIGH) / 2);

  const expPre = gainScores?.experiment?.pre_avg;
  const expPost = gainScores?.experiment?.post_avg;
  const ctrlPre = gainScores?.control?.pre_avg;
  const ctrlPost = gainScores?.control?.post_avg;

  const comparisonData = {
    labels: ["Начальный замер\n(входной контроль)", "Конечный замер\n(итоговый контроль)"],
    datasets: [
      {
        label: "Экспериментальная группа (ЭОР)",
        data: [expPre ?? null, expPost ?? null],
        backgroundColor: PALETTE.indigo + "cc",
        borderRadius: 8,
        borderSkipped: false,
      },
      {
        label: "Контрольная группа",
        data: [ctrlPre ?? null, ctrlPost ?? null],
        backgroundColor: PALETTE.slate + "99",
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const hasComparison = [expPre, expPost, ctrlPre, ctrlPost].some((v) => v !== null && v !== undefined);
  const hasExperimentData = [expPre, expPost].some((v) => v !== null && v !== undefined);

  const gainInterpretation = (() => {
    if (expPre !== null && expPre !== undefined && expPost !== null && expPost !== undefined) {
      const gain = gainScores?.experiment?.gain;
      if (ctrlPost !== null && ctrlPost !== undefined && ctrlPre !== null && ctrlPre !== undefined) {
        const ctrlGain = gainScores?.control?.gain;
        return `Прирост результатов («пост» минус «пред») в экспериментальной выборке: ${gain ?? "—"} %. В контрольной выборке: ${ctrlGain ?? "—"} %. ${
          gain !== null && ctrlGain !== null && gain > ctrlGain
            ? "Больший прирост наблюдается в экспериментальной группе, что можно интерпретировать в пользу разработанного ЭОР (при сопоставимости условий и объёме выборки)."
            : ""
        }`;
      }
      return `Прирост результатов от начального к конечному замеру в экспериментальной группе: ${gain ?? "—"} %.`;
    }
    if (hasExperimentData) {
      return "Добавьте итоговые баллы экспериментальной группы, чтобы вычислить прирост относительно входного замера.";
    }
    return "Введите результаты ниже, чтобы построить сравнительный график.";
  })();

  const allResults = [
    ...externalTests.experiment.pre.map((r) => ({ ...r, gt: "experiment", tt: "pre" })),
    ...externalTests.experiment.post.map((r) => ({ ...r, gt: "experiment", tt: "post" })),
    ...externalTests.control.pre.map((r) => ({ ...r, gt: "control", tt: "pre" })),
    ...externalTests.control.post.map((r) => ({ ...r, gt: "control", tt: "post" })),
  ];

  const GT_LABELS = { experiment: "Экспер.", control: "Контр." };
  const TT_LABELS = { pre: "входной", post: "итоговый" };

  return (
    <Block
      number="5"
      title="Сравнительный анализ: входное и итоговое тестирование, норма ОГЭ"
      hypothesis="Сопоставление динамики успеваемости (прирост от начального к конечному замеру) в экспериментальной и контрольной выборках; ориентация на опубликованные уровни по ОГЭ (23–53 %)."
      interpretation={gainInterpretation}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* График pre/post */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Средние доли успешности: входной и итоговый контроли
          </div>
          <div style={{ height: 240 }} className="relative">
            {hasComparison ? (
              <Bar
                data={comparisonData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: true, position: "bottom" },
                    tooltip: { mode: "index", intersect: false },
                  },
                  scales: {
                    y: { min: 0, max: 100, title: { display: true, text: "%" } },
                  },
                }}
              />
            ) : <EmptyState small text="Введите данные тестов" />}
          </div>
          {/* OGE benchmark */}
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">
            <div className="font-semibold text-amber-800 mb-1">Норма ОГЭ (задачи повышенного уровня)</div>
            <div className="text-amber-700 text-xs">
              По регионам РФ: <strong>{OGE_BENCHMARK_LOW}–{OGE_BENCHMARK_HIGH}%</strong> правильных ответов (ср. {OGE_BENCHMARK_MID}%)
              — источник: аналитические отчёты ФИПИ 2024 г.
            </div>
            {expPost !== null && expPost !== undefined && (
              <div className={`mt-2 font-semibold text-xs ${expPost > OGE_BENCHMARK_MID ? "text-emerald-700" : "text-slate-600"}`}>
                Средний итоговый результат экспериментальной группы: {expPost}% — {expPost > OGE_BENCHMARK_HIGH ? "выше порога, характерного для задач повышенного уровня в отчётности по ОГЭ" : expPost > OGE_BENCHMARK_MID ? "выше среднего уровня, приводимого в статистике по ОГЭ" : "в диапазоне, сопоставимом с региональными уровнями по ОГЭ"}.
              </div>
            )}
          </div>
          {/* Сводка по приросту */}
          {(gainScores?.experiment?.gain !== null && gainScores?.experiment?.gain !== undefined) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-indigo-50 p-3 text-center">
                <div className="text-lg font-bold text-indigo-700">+{gainScores.experiment.gain}%</div>
                <div className="text-xs text-indigo-500">Прирост (ЭОР)</div>
              </div>
              {gainScores?.control?.gain !== null && gainScores?.control?.gain !== undefined && (
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="text-lg font-bold text-slate-700">+{gainScores.control.gain}%</div>
                  <div className="text-xs text-slate-500">Прирост (контроль)</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Форма ввода */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Добавить результат теста
          </div>
          <form onSubmit={handleAdd} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Группа</label>
                <select
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                  value={form.group_type}
                  onChange={(e) => setForm((f) => ({ ...f, group_type: e.target.value }))}
                >
                  <option value="experiment">Экспериментальная группа</option>
                  <option value="control">Контрольная</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Тип теста</label>
                <select
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                  value={form.test_type}
                  onChange={(e) => setForm((f) => ({ ...f, test_type: e.target.value }))}
                >
                  <option value="pre">Входной контроль</option>
                  <option value="post">Итоговый контроль</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Код участника</label>
                <input
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                  placeholder="Ученик-01"
                  value={form.participant_code}
                  onChange={(e) => setForm((f) => ({ ...f, participant_code: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Результат (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                  placeholder="75"
                  value={form.score_percent}
                  onChange={(e) => setForm((f) => ({ ...f, score_percent: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Верных задач</label>
                <input
                  type="number"
                  min="0"
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                  placeholder="3"
                  value={form.correct_tasks}
                  onChange={(e) => setForm((f) => ({ ...f, correct_tasks: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Всего задач</label>
                <input
                  type="number"
                  min="1"
                  className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                  value={form.max_tasks}
                  onChange={(e) => setForm((f) => ({ ...f, max_tasks: e.target.value }))}
                />
              </div>
            </div>
            {addErr && <p className="text-red-600 text-xs">{addErr}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {busy ? "Сохранение…" : "Добавить результат"}
            </button>
          </form>

          {/* Список введённых результатов */}
          {allResults.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
              {allResults.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className="text-slate-600">
                    <span className={`font-semibold ${r.gt === "experiment" ? "text-indigo-600" : "text-slate-500"}`}>
                      [{GT_LABELS[r.gt]} {TT_LABELS[r.tt]}]
                    </span>
                    {" "}{r.participant_code}
                  </span>
                  <span className="font-semibold text-slate-800">{r.score_percent}%</span>
                  <button
                    type="button"
                    onClick={() => onDeleteResult(r.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors text-base leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Block>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ small = false, text = "Нет данных" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-slate-400 ${small ? "h-full" : "py-12"}`}>
      <div className="text-3xl">📊</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function ResearchDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedKS, setSelectedKS] = useState("");
  const [ksList, setKsList] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (selectedGroup) params.append("group_id", selectedGroup);
      if (selectedKS) params.append("ks_id", selectedKS);
      const result = await api(`/api/analytics/research-report/?${params}`);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, selectedKS]);

  // Загрузить список СК для фильтра
  useEffect(() => {
    api("/api/ks/?page_size=200").then((d) => {
      const items = Array.isArray(d) ? d : (d.results || []);
      setKsList(items);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddResult = async (form) => {
    setBusy(true);
    try {
      await api("/api/analytics/external-test/", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          score_percent: parseFloat(form.score_percent),
          correct_tasks: parseInt(form.correct_tasks || 0),
          max_tasks: parseInt(form.max_tasks || 5),
          study_group_id: form.study_group_id || null,
        }),
      });
      await loadData();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteResult = async (id) => {
    if (!confirm("Удалить запись?")) return;
    setBusy(true);
    try {
      await api(`/api/analytics/external-test/${id}/`, { method: "DELETE" });
      await loadData();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const { summary, funnel, ood_correlation, comp_attempts_dist, mastery_by_difficulty,
    learning_path_dist, step_learning_curve, step_difficulty, external_tests, gain_scores, groups } = data || {};

  return (
    <div className="space-y-6">
      {/* Заголовок и фильтры */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Исследовательская аналитика</h2>
            <p className="text-sm text-slate-500 mt-1">
              Обработка данных апробации электронного ресурса · эмпирические проверки положений ТПФУД · материал для экспериментальной части работы
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <option value="">Все группы</option>
              {(groups || []).map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
            <select
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
              value={selectedKS}
              onChange={(e) => setSelectedKS(e.target.value)}
            >
              <option value="">Все системы знаний</option>
              {ksList.map((ks) => (
                <option key={ks.id} value={ks.id}>{ks.title}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Загрузка…" : "Обновить"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Сводные карточки */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
            <StatCard label="Траекторий" value={summary.total_sessions} icon="📚" color="indigo" />
            <StatCard label="Завершено" value={summary.completed_sessions} sub={`${summary.completion_rate}%`} icon="✅" color="emerald" />
            <StatCard label="Зачёт" value={summary.passed_sessions} sub={`${summary.pass_rate}%`} icon="🏆" color="purple" />
            <StatCard label="Усвоение" value={summary.avg_mastery != null ? `${summary.avg_mastery}%` : "—"} sub="среднее" icon="📈" color="sky" />
            <StatCard label="Осмысление" value={summary.avg_comprehension != null ? `${summary.avg_comprehension}%` : "—"} sub="среднее" icon="🎯" color="amber" />
            <StatCard label="Время" value={summary.avg_time_minutes != null ? `${summary.avg_time_minutes} мин` : "—"} sub="на траекторию" icon="⏱" color="rose" />
          </div>
        )}
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <div className="text-center">
            <div className="text-4xl mb-3 animate-pulse">📊</div>
            <div>Загрузка данных…</div>
          </div>
        </div>
      )}

      {data && (
        <>
          <FunnelBlock funnel={funnel} summary={summary} />
          <OODCorrelationBlock oodCorrelation={ood_correlation} compAttemptsDist={comp_attempts_dist} />
          <AdaptiveBlock masteryByDifficulty={mastery_by_difficulty} learningPathDist={learning_path_dist} />
          <LearningCurveBlock stepLearningCurve={step_learning_curve} stepDifficulty={step_difficulty} />
          <ComparisonBlock
            externalTests={external_tests || { experiment: { pre: [], post: [] }, control: { pre: [], post: [] } }}
            gainScores={gain_scores}
            groups={groups || []}
            onAddResult={handleAddResult}
            onDeleteResult={handleDeleteResult}
            busy={busy}
          />
        </>
      )}
    </div>
  );
}
