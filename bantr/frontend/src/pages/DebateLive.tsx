import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LiveDebateRoom } from "../components/debate/LiveDebateRoom";
import { PageContainer } from "../components/layout/PageContainer";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { useDebate } from "../hooks/useDebate";
import { useLiveKitSession } from "../hooks/useLiveKitSession";
import { endDebate, startDebate } from "../services/debates";
import { ApiError } from "../types/api";

function isBenignLiveKitError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("client initiated disconnect") ||
    normalized.includes("websocket is closed before the connection is established") ||
    normalized.includes("abort connection attempt due to user initiated disconnect")
  );
}

export function DebateLive() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const livekit = useLiveKitSession(id);
  const { prepare, disconnect, status: livekitStatus, token, url } = livekit;
  const { debate, setDebate, loading, error, setError, loadDebate } = useDebate(id);

  useEffect(() => {
    if (!debate || debate.status !== "active" || livekitStatus !== "idle") {
      return;
    }

    void prepare().catch((issue) => {
      setError(issue instanceof ApiError ? issue.message : "Unable to join the LiveKit room.");
    });
  }, [debate, livekitStatus, prepare, setError]);

  useEffect(() => {
    if (!debate || (debate.status !== "active" && debate.status !== "ending")) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadDebate().catch(() => undefined);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [debate, loadDebate]);

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      const response = await startDebate(id);
      await prepare({ token: response.livekit_token, url: response.livekit_url });
      setDebate((current) =>
        current
          ? { ...current, status: response.status, livekit_room_name: response.livekit_room_name }
          : current,
      );
      await loadDebate();
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to start the live debate.");
    } finally {
      setStarting(false);
    }
  }

  async function handleEnd() {
    setEnding(true);
    setError("");
    try {
      const response = await endDebate(id);
      setDebate((current) => (current ? { ...current, status: response.status } : current));
      disconnect();
      await loadDebate();
      navigate(`/debates/${id}`);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to end the debate.");
    } finally {
      setEnding(false);
    }
  }

  function handleLeave() {
    disconnect();
    navigate(`/debates/${id}`);
  }

  function handleRoomError(issue: Error) {
    if (isBenignLiveKitError(issue.message)) {
      return;
    }
    setError(issue.message);
  }

  if (loading) {
    return <Spinner />;
  }

  if (error && !debate) {
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={loadDebate} />
      </PageContainer>
    );
  }

  if (!debate) {
    return null;
  }

  return (
    <PageContainer className="space-y-6">
      {error ? <ErrorState message={error} onRetry={loadDebate} /> : null}

      {debate.status === "pending" ? (
        <Card className="p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Live room</p>
          <h1 className="mt-3 text-4xl font-headline font-extrabold text-on-background">
            {debate.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            This room is ready, but the debate has not started yet. Start the debate to dispatch the Bantr agent and join the live call.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-headline font-bold text-on-primary transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? "Starting debate..." : "Start and join live debate"}
            </button>
            <Link
              to={`/debates/${id}`}
              className="inline-flex items-center justify-center rounded-full bg-surface-container px-6 py-3 font-headline font-bold text-on-surface"
            >
              Back to debate
            </Link>
          </div>
        </Card>
      ) : null}

      {debate.status === "starting" ? (
        <Card className="p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Connecting</p>
          <h1 className="mt-3 text-4xl font-headline font-extrabold text-on-background">
            {debate.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            Bantr is provisioning the room and dispatching the agent. This usually takes a few seconds.
          </p>
        </Card>
      ) : null}

      {debate.status === "active" ? (
        <LiveDebateRoom
          roomName={debate.livekit_room_name}
          title={debate.title}
          token={token}
          url={url}
          isEnding={ending}
          onLeave={handleLeave}
          onEnd={handleEnd}
          onDisconnected={() => setError("")}
          onError={handleRoomError}
        />
      ) : null}

      {debate.status === "ending" ? (
        <Card className="p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Finalizing</p>
          <h1 className="mt-3 text-4xl font-headline font-extrabold text-on-background">
            {debate.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            The room has been closed. Bantr is finalizing transcript capture before analysis becomes available.
          </p>
          <div className="mt-8">
            <Link
              to={`/debates/${id}`}
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-headline font-bold text-on-primary"
            >
              Return to debate detail
            </Link>
          </div>
        </Card>
      ) : null}

      {(debate.status === "completed" || debate.status === "failed") ? (
        <Card className="p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Live room unavailable</p>
          <h1 className="mt-3 text-4xl font-headline font-extrabold text-on-background">
            {debate.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            {debate.status === "completed"
              ? "This debate has already finished. Review the transcript and analysis from the debate detail page."
              : "This debate failed before completion, so the live room is no longer available."}
          </p>
          <div className="mt-8">
            <Link
              to={`/debates/${id}`}
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-headline font-bold text-on-primary"
            >
              Back to debate detail
            </Link>
          </div>
        </Card>
      ) : null}
    </PageContainer>
  );
}
