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

function wantsStudentOnlyMode() {
  try {
    return new URLSearchParams(window.location.search).get("student") === "1";
  } catch {
    return false;
  }
}

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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="card p-8 max-w-md w-full animate-fadeIn">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-emerald-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <span className="text-white font-bold text-lg">⚛</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Вход</h2>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Логин</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Пароль</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <button type="submit" className="btn-primary btn-lg w-full" disabled={busy}>
            {busy ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Portal() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

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

  const showTeacher = Boolean(user.is_staff) && !wantsStudentOnlyMode();

  return (
    <Suspense fallback={<LoadingBoot />}>
      {showTeacher ? <TeacherApp /> : <StudentApp />}
    </Suspense>
  );
}
