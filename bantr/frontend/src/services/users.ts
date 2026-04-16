import type { AdminUser } from "../types/user";
import { apiRequest } from "./api";

export async function listUsers() {
  return apiRequest<AdminUser[]>("/users", { method: "GET" });
}
