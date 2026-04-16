import type { LoginPayload, RegisterPayload, UserProfile } from "../types/auth";
import { apiRequest } from "./api";

const API_ROOT = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export async function getCurrentUser() {
  return apiRequest<UserProfile>("/auth/me", { method: "GET" });
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
