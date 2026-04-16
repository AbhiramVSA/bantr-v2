import type { ChatMessage, ChatResponse } from "../types/chat";
import { apiRequest } from "./api";

export async function getChatHistory() {
  return apiRequest<ChatMessage[]>("/chat/history", { method: "GET" });
}

export async function sendChatMessage(message: string) {
  return apiRequest<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function clearChatHistory() {
  return apiRequest<{ status: string }>("/chat/history", {
    method: "DELETE",
  });
}
