import { useCallback, useEffect, useState } from "react";
import { getDebate } from "../services/debates";
import type { Debate } from "../types/debate";
import { ApiError } from "../types/api";

type LoadDebateOptions = {
  silent?: boolean;
};

export function useDebate(debateId: string) {
  const [debate, setDebate] = useState<Debate | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDebate = useCallback(async (options?: LoadDebateOptions) => {
    const silent = options?.silent ?? false;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError("");
    }
    try {
      const response = await getDebate(debateId);
      setDebate(response);
      return response;
    } catch (issue) {
      const message = issue instanceof ApiError ? issue.message : "Unable to load debate.";
      setError(message);
      throw issue;
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [debateId]);

  useEffect(() => {
    void loadDebate().catch(() => undefined);
  }, [loadDebate]);

  return {
    debate,
    setDebate,
    loading,
    refreshing,
    error,
    setError,
    loadDebate,
  };
}
