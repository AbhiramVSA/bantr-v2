import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { listDebates } from "../services/debates";
import type { Debate } from "../types/debate";
import { ApiError } from "../types/api";
import { formatDate } from "../utils/format";

function notificationCopy(debate: Debate) {
  switch (debate.status) {
    case "pending":
      return "Your debate is queued and ready to start.";
    case "starting":
      return "Bantr is provisioning your room and dispatching the agent.";
    case "active":
      return "Your debate is currently active.";
    case "ending":
      return "Bantr is wrapping up the room and waiting on transcript persistence.";
    case "completed":
      return "Transcript and analysis should now be available.";
    case "failed":
      return "This debate failed to complete. You can review or delete it.";
    default:
      return "Debate state updated.";
  }
}

export function Notifications() {
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDebates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listDebates();
      setDebates(response);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDebates();
  }, [loadDebates]);

  const notifications = useMemo(() => debates.slice(0, 12), [debates]);

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">
          Notifications
        </h1>
        <p className="mt-3 text-lg text-on-surface-variant">
          Recent debate state changes and follow-up actions.
        </p>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorState message={error} onRetry={loadDebates} /> : null}

      {!loading && !error ? (
        <div className="grid gap-5">
          {notifications.length ? (
            notifications.map((debate) => (
              <Card key={debate.id} className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <Badge status={debate.status} />
                    <h2 className="mt-4 text-2xl font-headline font-extrabold text-on-background">
                      {debate.title}
                    </h2>
                    <p className="mt-2 text-on-surface-variant">{notificationCopy(debate)}</p>
                    <p className="mt-3 text-sm text-on-surface-variant">
                      Updated {formatDate(debate.ended_at ?? debate.started_at ?? debate.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={`/debates/${debate.id}`}
                      className="rounded-full bg-primary px-5 py-3 font-headline font-bold text-on-primary"
                    >
                      Open Debate
                    </Link>
                    {debate.status === "completed" ? (
                      <Link
                        to={`/analysis/${debate.id}`}
                        className="rounded-full bg-surface-container px-5 py-3 font-headline font-bold text-on-surface"
                      >
                        View Analysis
                      </Link>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center text-on-surface-variant">
              No notifications yet. Debate updates will appear here.
            </Card>
          )}
        </div>
      ) : null}
    </PageContainer>
  );
}
