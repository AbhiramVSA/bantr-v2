export type DebateStatus =
  | "pending"
  | "starting"
  | "active"
  | "ending"
  | "completed"
  | "failed";

export type Debate = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  agent_prompt: string;
  agent_voice_id: string;
  status: DebateStatus;
  livekit_room_name: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export type CreateDebatePayload = {
  title: string;
  topic: string;
  agent_prompt: string;
  agent_voice_id: string;
};

export type DebateStartResponse = {
  status: DebateStatus;
  livekit_token: string;
  livekit_url: string;
  livekit_room_name: string;
};

export type DebateEndResponse = {
  status: DebateStatus;
};

export type Transcript = {
  id: string;
  debate_id: string;
  full_text: string;
  speaker_segments: TranscriptSpeakerSegment[];
  created_at: string;
};

export type TranscriptSpeakerSegment = {
  speaker?: "user" | "agent" | string;
  text?: string;
  start_time?: number;
  end_time?: number;
};

export type Analysis = {
  id: string;
  debate_id: string;
  argument_strength: Record<string, unknown>;
  logical_fallacies: Array<Record<string, unknown>>;
  persuasiveness: Record<string, unknown>;
  key_moments: Array<Record<string, unknown>>;
  improvement_areas: Array<Record<string, unknown>>;
  overall_summary: string;
  winner: string | null;
  created_at: string;
};

export type LiveKitTokenResponse = {
  token: string;
  url: string;
};
