/**
 * Shared CSRF + fetch utilities for EORA frontend.
 *
 * IMPORTANT: CSRF_COOKIE_HTTPONLY=True is set in Django settings, so JavaScript
 * cannot read the csrftoken cookie via document.cookie. Instead we call /api/csrf/
 * which returns {"csrfToken": "..."} in the JSON body.
 *
 * This module is an ES module singleton — _csrfToken is shared across ALL imports.
 * Portal.jsx calls ensureCSRFToken() on boot; App.jsx, TeacherApp.jsx etc. all
 * get the same cached token automatically.
 */

let _csrfToken = "";

/** Returns the cached CSRF token (empty string if not yet fetched). */
export const getCSRFToken = () => _csrfToken;

/**
 * Fetches a fresh CSRF token from /api/csrf/ and caches it.
 * Always refetches — call this before any mutating request if you're unsure
 * whether the token is still valid.
 */
export const ensureCSRFToken = async () => {
  try {
    const res = await fetch("/api/csrf/", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (data.csrfToken) _csrfToken = data.csrfToken;
  } catch {
    // ignore network errors — token stays as-is
  }
};

/**
 * Central fetch wrapper: always ensures CSRF token before the request,
 * attaches credentials and Content-Type automatically.
 *
 * @param {string} url - relative or absolute URL
 * @param {object} options - standard fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(url, options = {}) {
  await ensureCSRFToken();
  const headers = {
    "Content-Type": "application/json",
    "X-CSRFToken": _csrfToken,
    ...options.headers,
  };
  return fetch(url, { ...options, credentials: "include", headers });
}

/**
 * apiFetch + JSON parse + error throw.
 * Throws an Error with the server's detail message on non-2xx responses.
 *
 * @param {string} url
 * @param {object} options
 * @returns {Promise<any>} parsed JSON
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
 * FormData (file upload) variant — omits Content-Type so browser sets multipart boundary.
 *
 * @param {string} url
 * @param {FormData} formData
 * @returns {Promise<Response>}
 */
export async function apiFetchForm(url, formData) {
  await ensureCSRFToken();
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": _csrfToken },
    body: formData,
  });
}

// ---------------------------------------------------------------------------
// Legacy aliases — keep for backward compat while migrating old call sites
// ---------------------------------------------------------------------------
/** @deprecated use getCSRFToken() */
export const getCsrfToken = getCSRFToken;
/** @deprecated use ensureCSRFToken() */
export const ensureCsrfToken = ensureCSRFToken;
