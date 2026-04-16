import { ApiError, type ApiErrorShape } from "../types/api";
import { getCookie } from "../utils/cookies";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:8000/api/v1" : "/api/v1");
const AUTH_RETRY_EXCLUDED_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/logout",
  "/auth/refresh",
]);

type RequestOptions = RequestInit & {
  skipJsonParsing?: boolean;
  skipAuthRetry?: boolean;
};

let refreshPromise: Promise<void> | null = null;

function buildHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const csrfToken = getCookie("csrf_token");
  if (csrfToken && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  return headers;
}

async function parseError(response: Response) {
  let payload: ApiErrorShape | null = null;

  try {
    payload = (await response.json()) as ApiErrorShape;
  } catch {
    payload = null;
  }

  return new ApiError(
    response.status,
    payload?.error.code ?? "HTTP_ERROR",
    payload?.error.message ?? "Request failed",
    payload?.error.details ?? null,
  );
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: buildHeaders(),
      });

      if (!response.ok) {
        throw await parseError(response);
      }

      await response.json().catch(() => undefined);
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function shouldRetryWithRefresh(path: string, options: RequestOptions, response: Response) {
  return response.status === 401 && !options.skipAuthRetry && !AUTH_RETRY_EXCLUDED_PATHS.has(path);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: buildHeaders(options.headers),
  });

  if (!response.ok) {
    if (shouldRetryWithRefresh(path, options, response)) {
      try {
        await refreshAccessToken();
        return await apiRequest<T>(path, { ...options, skipAuthRetry: true });
      } catch {
        throw await parseError(response);
      }
    }

    throw await parseError(response);
  }

  if (options.skipJsonParsing || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
