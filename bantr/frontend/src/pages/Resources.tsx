import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { listDebates } from "../services/debates";
import type { Debate } from "../types/debate";
import { ApiError } from "../types/api";
import { formatDate } from "../utils/format";

export function Resources() {
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
      setError(issue instanceof ApiError ? issue.message : "Unable to load debate resources.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDebates();
  }, [loadDebates]);

  const archivedDebates = useMemo(
    () => debates.filter((debate) => debate.status === "completed" || debate.status === "failed"),
    [debates],
  );

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">
          Resources
        </h1>
        <p className="mt-3 text-lg text-on-surface-variant">
          Completed and failed debates with quick access to transcripts and analysis.
        </p>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorState message={error} onRetry={loadDebates} /> : null}

      {!loading && !error ? (
        <div className="grid gap-6">
          {archivedDebates.length ? (
            archivedDebates.map((debate) => (
              <Card key={debate.id} className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                      {debate.status}
                    </div>
                    <h2 className="mt-2 text-2xl font-headline font-extrabold text-on-background">
                      {debate.title}
                    </h2>
                    <p className="mt-2 text-on-surface-variant">{debate.topic}</p>
                    <p className="mt-3 text-sm text-on-surface-variant">
                      Created {formatDate(debate.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={`/debates/${debate.id}`}
                      className="rounded-full bg-surface-container px-5 py-3 font-headline font-bold text-on-surface"
                    >
                      Open Debate
                    </Link>
                    {debate.status === "completed" ? (
                      <>
                        <Link
                          to={`/transcript/${debate.id}`}
                          className="rounded-full bg-surface-container px-5 py-3 font-headline font-bold text-on-surface"
                        >
                          Transcript
                        </Link>
                        <Link
                          to={`/analysis/${debate.id}`}
                          className="rounded-full bg-primary px-5 py-3 font-headline font-bold text-on-primary"
                        >
                          Analysis
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center text-on-surface-variant">
              No completed debate resources yet. Finish a debate to unlock transcripts and analysis.
            </Card>
          )}
        </div>
      ) : null}
    </PageContainer>
  );
}
