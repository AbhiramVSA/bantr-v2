import type { LoginPayload, RegisterPayload, UserProfile } from "../types/auth";
import { apiRequest } from "./api";

const API_ROOT =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:8000/api/v1" : "/api/v1");

type AuthPayload = {
  id: string;
  email: string;
  username: string;
  role?: string | { id?: string; name?: string; description?: string } | null;
  permissions?:
    | string[]
    | Array<string | { id?: string; name?: string; description?: string }>
    | null;
};

function normalizeUserProfile(payload: AuthPayload): UserProfile {
  const normalizedRole =
    typeof payload.role === "string"
      ? payload.role
      : payload.role && typeof payload.role === "object"
        ? payload.role.name ?? null
        : null;

  const normalizedPermissions = Array.isArray(payload.permissions)
    ? payload.permissions
        .map((permission) =>
          typeof permission === "string"
            ? permission
            : permission && typeof permission === "object"
              ? permission.name
              : null,
        )
        .filter((permission): permission is string => Boolean(permission))
    : [];

  return {
    id: payload.id,
    email: payload.email,
    username: payload.username,
    role: normalizedRole,
    permissions: normalizedPermissions,
  };
}

export async function getCurrentUser() {
  const response = await apiRequest<AuthPayload>("/auth/me", { method: "GET" });
  return normalizeUserProfile(response);
}

export async function login(payload: LoginPayload) {
  return apiRequest<{ status: string; user_id: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function register(payload: RegisterPayload) {
  return apiRequest<{ status: string; user_id: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  return apiRequest<{ status: string }>("/auth/logout", {
    method: "POST",
  });
}

export async function refreshSession() {
  return apiRequest<{ status: string; user_id: string }>("/auth/refresh", {
    method: "POST",
    skipAuthRetry: true,
  });
}

export function getGoogleLoginUrl() {
  return `${API_ROOT}/auth/google/login`;
}
