import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DebateCard } from "../components/debate/DebateCard";
import { PageContainer } from "../components/layout/PageContainer";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { listDebates } from "../services/debates";
import type { Debate } from "../types/debate";
import { ApiError } from "../types/api";

export function Dashboard() {
  const [debates, setDebates] = useState<Debate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ongoingDebates = debates.filter(
    (debate) => debate.status === "pending" || debate.status === "starting" || debate.status === "active" || debate.status === "ending",
  );

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

  return (
    <PageContainer>
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background mb-2">Active Debates</h1>
          <p className="text-on-surface-variant font-medium text-lg">
            Your ongoing logical skirmishes and open challenges.
          </p>
        </div>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorState message={error} onRetry={loadDebates} /> : null}

      {!loading && !error ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ongoingDebates.slice(0, 3).map((debate, index) => (
            <DebateCard key={debate.id} debate={debate} index={index} />
          ))}

          <div className="lg:col-span-2 relative bg-primary rounded-xl overflow-hidden min-h-[320px] sticker-shadow flex items-center p-12">
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-container opacity-90" />
              <img
                alt="Training Background"
                className="w-full h-full object-cover mix-blend-overlay"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCYPSybSRKTpXHhc61mU8UyIRUj8Jz7saHbk-BOPyM99RHJIgM_5hszdlCIJZsKWfnnMhFMDS9qow3sTmwSrb-22It0Qt4BHa-Z-gLhGoNDN7Q0dvGPqDeLncDr7_IUYvOWlSut4FH9odtRzJMyzUSiGOvex3lt-0kpYBQtV5uTgKvQa_BbqAO1n1ZZhOMcOgD6kCjmPOpO4WoRNdfwkyaF19IvZ4j5s9iNKmp3AqeJ-KgCohxjGYqeWfh4BrMyr7Mjv2PZ2mZIxS8"
              />
            </div>
            <div className="relative z-10 w-full md:w-2/3">
              <span className="inline-block bg-secondary-fixed text-on-secondary-fixed px-3 py-1 rounded-lg font-bold text-xs uppercase mb-4">
                New Laboratory
              </span>
              <h2 className="text-4xl font-headline font-extrabold text-white mb-6">
                Sharpen your logic with the AI Voice Lab
              </h2>
              <p className="text-on-primary text-lg mb-8 opacity-90">
                Practice your delivery with real-time feedback on tone, cadence, and logical fallacies.
              </p>
              <Link
                to="/create"
                className="bg-white text-primary px-10 py-4 rounded-full font-headline font-bold uppercase tracking-wider text-sm spring-bounce-interaction shadow-lg inline-flex"
              >
                Enter Lab
              </Link>
            </div>
          </div>

          <EmptyState
            title={ongoingDebates.length ? "More room for new debates" : "No active debates yet"}
            description={
              ongoingDebates.length
                ? "Your queue still has space. Create another challenge when you are ready."
                : "You do not have any pending, starting, active, or ending debates right now."
            }
            action={
              <Link
                to="/create"
                className="text-primary font-bold text-sm underline underline-offset-4 decoration-secondary-fixed decoration-4"
              >
                Create One Now
              </Link>
            }
          />
        </div>
      ) : null}
    </PageContainer>
  );
}
