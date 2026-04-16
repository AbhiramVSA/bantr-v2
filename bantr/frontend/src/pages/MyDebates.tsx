import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { listDebates } from "../services/debates";
import type { Debate, DebateStatus } from "../types/debate";
import { ApiError } from "../types/api";
import { formatDate } from "../utils/format";

const filters: Array<{ label: string; value: "all" | DebateStatus }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Starting", value: "starting" },
  { label: "Active", value: "active" },
  { label: "Ending", value: "ending" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

export function MyDebates() {
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | DebateStatus>("all");

  const loadDebates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listDebates();
      setDebates(response);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to load debates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDebates();
  }, [loadDebates]);

  const filteredDebates = useMemo(
    () => (filter === "all" ? debates : debates.filter((debate) => debate.status === filter)),
    [debates, filter],
  );

  return (
    <PageContainer className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">
            My Debates
          </h1>
          <p className="mt-3 text-lg text-on-surface-variant">
            Every Bantr debate you have created, with direct access to live and archived sessions.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                filter === item.value
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-surface-container text-on-surface"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorState message={error} onRetry={loadDebates} /> : null}

      {!loading && !error ? (
        <div className="grid gap-5">
          {filteredDebates.length ? (
            filteredDebates.map((debate) => (
              <Card key={debate.id} className="p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <Badge status={debate.status} />
                    <h2 className="mt-4 text-2xl font-headline font-extrabold text-on-background">
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
                      className="rounded-full bg-primary px-5 py-3 font-headline font-bold text-on-primary"
                    >
                      Open
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
                          className="rounded-full bg-surface-container px-5 py-3 font-headline font-bold text-on-surface"
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
              No debates match the selected filter.
            </Card>
          )}
        </div>
      ) : null}
    </PageContainer>
  );
}
