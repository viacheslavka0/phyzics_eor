import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";

const StudentApp = lazy(() => import("./App.jsx"));
const TeacherApp = lazy(() => import("./TeacherApp.jsx"));

const getCSRFCookie = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

const ensureCSRFCookie = async () => {
  if (getCSRFCookie()) return;
  await fetch("/api/csrf/", { credentials: "include" });
};


function LoadingBoot() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Загрузка…</p>
      </div>
    </div>
  );
}

function UnifiedLogin({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      await ensureCSRFCookie();
      const res = await fetch("/api/auth/login/", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFCookie(),
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось войти");
      const session = await onLoggedIn();
      if (session && session.ok === false) {
        const hint =
          session.status === 403 || session.status === 401
            ? "Сессия не дошла до API (часто: открыли сайт как localhost, а админку как 127.0.0.1 — это разные сайты для cookie; или http при secure-cookie). "
            : "";
        setMsg(
          `${hint}Вход ответил успешно, но профиль не загрузился (HTTP ${session.status}). ` +
            `Откройте DevTools → Network → запрос «me» и посмотрите ответ. Фрагмент: ${(session.detail || "").slice(0, 180)}`
        );
      }
    } catch (err) {
      setMsg(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel - Branding (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 items-center justify-center p-8 bg-gradient-to-br from-indigo-600 via-indigo-500 to-emerald-600">
        <div className="max-w-sm text-center text-white animate-fadeIn">
          <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-2xl flex items-center justify-center shadow-lg">
            <img src="/logo.png" alt="Логотип" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold mb-2 leading-snug text-white">ЭОР по усвоению систем физических знаний</h1>
          <p className="text-base text-indigo-100 mb-6">7–9 класс</p>
          <div className="border-t border-white/30 pt-6">
            <p className="text-sm italic text-indigo-200">
              "Физика — это не просто формулы. Это язык, на котором говорит вселенная."
            </p>
          </div>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm animate-fadeIn">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-1">Добро пожаловать</h2>
            <p className="text-slate-600 text-sm">Введите учетные данные для входа</p>
          </div>

          <form className="space-y-5" onSubmit={submit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Логин</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                placeholder="Ваш логин"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Пароль</label>
              <input
                type="password"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="Пароль"
              />
            </div>

            {msg && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">{msg}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              disabled={busy}
            >
              {busy && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {busy ? "Вход…" : "Войти"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            Система адаптивного обучения физике для учеников 7–9 класса
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Portal() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [forceStudentView, setForceStudentView] = useState(() => {
    try {
      return window.sessionStorage.getItem("eora_force_student_view") === "1";
    } catch {
      return false;
    }
  });

  const refreshUser = useCallback(async () => {
    try {
      const r = await fetch("/api/account/me/", { credentials: "include" });
      if (r.ok) {
        setUser(await r.json());
        return { ok: true };
      }
      setUser(null);
      const raw = await r.text();
      return { ok: false, status: r.status, detail: raw.slice(0, 500) };
    } catch (e) {
      setUser(null);
      return { ok: false, status: 0, detail: String(e) };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureCSRFCookie().catch(() => {});
      if (!cancelled) await refreshUser();
      if (!cancelled) setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  if (booting) {
    return <LoadingBoot />;
  }

  if (!user) {
    return (
      <UnifiedLogin
        onLoggedIn={async () => {
          // Не включаем общий booting — иначе размонтируется форма входа до завершения /account/me/
          let out = await refreshUser();
          if (!out.ok) {
            await new Promise((r) => setTimeout(r, 250));
            out = await refreshUser();
          }
          return out;
        }}
      />
    );
  }

  // Роль определяется только сервером (is_staff), URL-параметры не должны влиять на доступ.
  const showTeacher = Boolean(user.is_staff) && !forceStudentView;

  const switchToStudentView = () => {
    if (!user?.is_staff) return;
    setForceStudentView(true);
    try {
      window.sessionStorage.setItem("eora_force_student_view", "1");
    } catch {
      // ignore
    }
  };

  const switchToTeacherView = () => {
    setForceStudentView(false);
    try {
      window.sessionStorage.removeItem("eora_force_student_view");
    } catch {
      // ignore
    }
  };

  return (
    <Suspense fallback={<LoadingBoot />}>
      {showTeacher ? (
        <TeacherApp currentUser={user} onSwitchToStudentView={switchToStudentView} />
      ) : (
        <StudentApp
          viewerUser={user}
          forcedStudentView={Boolean(user?.is_staff && forceStudentView)}
          onReturnToTeacher={switchToTeacherView}
        />
      )}
    </Suspense>
  );
}
