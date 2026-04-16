import type {
  Analysis,
  CreateDebatePayload,
  Debate,
  DebateEndResponse,
  DebateStartResponse,
  DebateStatus,
  LiveKitTokenResponse,
  Transcript,
} from "../types/debate";
import { apiRequest } from "./api";

export async function listDebates(status?: DebateStatus) {
  const query = status ? `?status=${status}` : "";
  return apiRequest<Debate[]>(`/debates${query}`, { method: "GET" });
}

export async function getDebate(debateId: string) {
  return apiRequest<Debate>(`/debates/${debateId}`, { method: "GET" });
}

export async function createDebate(payload: CreateDebatePayload) {
  return apiRequest<Debate>("/debates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startDebate(debateId: string) {
  return apiRequest<DebateStartResponse>(`/debates/${debateId}/start`, {
    method: "POST",
  });
}

export async function endDebate(debateId: string) {
  return apiRequest<DebateEndResponse>(`/debates/${debateId}/end`, {
    method: "POST",
  });
}

export async function deleteDebate(debateId: string) {
  return apiRequest<{ status: string; debate_id: string }>(`/debates/${debateId}`, {
    method: "DELETE",
  });
}

export async function getTranscript(debateId: string) {
  return apiRequest<Transcript>(`/debates/${debateId}/transcript`, { method: "GET" });
}

export async function getAnalysis(debateId: string) {
  return apiRequest<Analysis>(`/debates/${debateId}/analysis`, { method: "GET" });
}

export async function analyzeDebate(debateId: string) {
  return apiRequest<Analysis>(`/debates/${debateId}/analyze`, { method: "POST" });
}

export async function getLiveKitToken(debateId: string) {
  return apiRequest<LiveKitTokenResponse>("/livekit/token", {
    method: "POST",
    body: JSON.stringify({ debate_id: debateId }),
  });
}
