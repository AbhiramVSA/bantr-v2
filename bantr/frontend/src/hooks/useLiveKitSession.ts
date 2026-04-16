import { useCallback, useState } from "react";
import { getLiveKitToken } from "../services/debates";
import type { LiveKitTokenResponse } from "../types/debate";

export function useLiveKitSession(debateId?: string) {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const prepare = useCallback(async (session?: LiveKitTokenResponse | null) => {
    if (!debateId) {
      return null;
    }

    setStatus("loading");
    try {
      const response = session ?? (await getLiveKitToken(debateId));
      setToken(response.token);
      setUrl(response.url);
      setStatus("ready");
      return response;
    } catch (error) {
      setStatus("error");
      throw error;
    }
  }, [debateId]);

  const disconnect = useCallback(() => {
    setToken(null);
    setUrl(null);
    setStatus("idle");
  }, []);

  return {
    token,
    url,
    status,
    prepare,
    disconnect,
  };
}
