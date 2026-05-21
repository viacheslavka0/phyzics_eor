/**
 * Shared CSRF + fetch utilities for EORA frontend.
 *
 * CSRF_COOKIE_HTTPONLY = False (settings.py) — JS читает csrftoken cookie напрямую.
 * ensureCSRFToken() делает GET /api/csrf/ только если кука ещё не установлена.
 * Все файлы импортируют getCSRFToken / ensureCSRFToken из этого модуля (ES-синглтон).
 */

/** Читает csrftoken из document.cookie. */
export const getCSRFToken = () => {
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
};

/**
 * Убеждается что CSRF cookie установлена.
 * Делает GET /api/csrf/ только если куки нет — единоразово при старте.
 */
export const ensureCSRFToken = async () => {
  if (getCSRFToken()) return;
  try {
    await fetch("/api/csrf/", { credentials: "include" });
  } catch {
    // ignore network errors
  }
};

/**
 * Central fetch wrapper: credentials + CSRF header автоматически.
 * Не перезапрашивает /api/csrf/ перед каждым запросом — токен берётся из куки.
 */
export async function apiFetch(url, options = {}) {
  await ensureCSRFToken();
  const headers = {
    "Content-Type": "application/json",
    "X-CSRFToken": getCSRFToken(),
    ...options.headers,
  };
  return fetch(url, { ...options, credentials: "include", headers });
}

/**
 * apiFetch + JSON parse + error throw.
 */
export async function apiCall(url, options = {}) {
  const res = await apiFetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * FormData (file upload) variant.
 */
export async function apiFetchForm(url, formData) {
  await ensureCSRFToken();
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": getCSRFToken() },
    body: formData,
  });
}

// Legacy aliases
export const getCsrfToken = getCSRFToken;
export const ensureCsrfToken = ensureCSRFToken;
