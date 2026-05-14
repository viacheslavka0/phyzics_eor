/**
 * API utilities for EORA frontend.
 *
 * Centralized CSRF token management and authenticated fetch wrapper.
 * Replaces duplicate getCSRFCookie() logic across App.jsx, Portal.jsx, TeacherApp.jsx, Editor.jsx
 */

/**
 * Get API base URL. Defaults to localhost:8001 in dev, empty string in prod.
 * @returns {string} API base URL (empty string for same-origin)
 */
export function getApiBaseUrl() {
  // In development, API might be on a different port
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    const port = window.location.port;
    // If frontend is on 5173 or 5174 (Vite dev), use 8001 for backend
    if (port === "5173" || port === "5174") {
      return "http://localhost:8001";
    }
  }
  // In production, use relative URL (same origin)
  return "";
}

/**
 * Get CSRF token from cookies.
 * @returns {string} CSRF token or empty string
 */
export function getCsrfToken() {
  const name = "csrftoken";
  let cookieValue = "";
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

/**
 * Ensure CSRF cookie is set by making a dummy GET request.
 * Django's CsrfViewMiddleware sets the csrftoken cookie on GET requests.
 */
export async function ensureCsrfToken() {
  try {
    await fetch("/", { method: "GET", credentials: "same-origin" });
  } catch (err) {
    console.warn("Failed to ensure CSRF token:", err);
  }
}

/**
 * Authenticated fetch wrapper with automatic CSRF header injection.
 *
 * @param {string} url - The URL to fetch (can be relative or absolute)
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>} Fetch response
 *
 * @example
 * const data = await authFetch("/api/task/123/submit/", {
 *   method: "POST",
 *   body: JSON.stringify({ answer_numeric: 42 })
 * });
 */
export async function authFetch(url, options = {}) {
  const csrfToken = getCsrfToken();
  const baseUrl = getApiBaseUrl();
  const fullUrl = url.startsWith("http") ? url : baseUrl + url;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  return fetch(fullUrl, {
    ...options,
    headers,
    credentials: "include", // Include cookies (works with cross-origin too)
  });
}

/**
 * Authenticated fetch for multipart/form-data (e.g., file uploads).
 *
 * @param {string} url - The URL to fetch (can be relative or absolute)
 * @param {FormData} formData - FormData object with files
 * @returns {Promise<Response>} Fetch response
 *
 * @example
 * const formData = new FormData();
 * formData.append("answer_images", fileInput.files[0]);
 * formData.append("session_id", "123");
 * const data = await authFetchFormData("/api/task/456/submit/", formData);
 */
export async function authFetchFormData(url, formData) {
  const csrfToken = getCsrfToken();
  const baseUrl = getApiBaseUrl();
  const fullUrl = url.startsWith("http") ? url : baseUrl + url;

  const headers = {};
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  return fetch(fullUrl, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });
}

/**
 * Helper to parse JSON response with error handling.
 *
 * @param {Response} response - Fetch response object
 * @returns {Promise<object>} Parsed JSON data
 * @throws {Error} If response is not ok or JSON parsing fails
 *
 * @example
 * const response = await authFetch("/api/session/current/");
 * const data = await parseJsonResponse(response);
 */
export async function parseJsonResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail ||
        `API error: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

/**
 * Make authenticated API call with error handling.
 *
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Parsed JSON response
 * @throws {Error} On network or API error
 *
 * @example
 * try {
 *   const data = await apiCall("/api/ks/123/", { method: "GET" });
 *   setData(data);
 * } catch (err) {
 *   setError(err.message);
 * }
 */
export async function apiCall(url, options = {}) {
  const response = await authFetch(url, options);
  return parseJsonResponse(response);
}
