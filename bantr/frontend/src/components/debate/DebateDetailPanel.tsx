import { Link } from "react-router-dom";
import type { Debate } from "../../types/debate";
import { formatDate } from "../../utils/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

type Props = {
  debate: Debate;
  onStart: () => void;
  onEnd: () => void;
  onDelete: () => void;
  isStarting: boolean;
  isEnding: boolean;
  isDeleting: boolean;
  livekitRoomName?: string;
  livekitUrl?: string | null;
};

export function DebateDetailPanel({
  debate,
  onStart,
  onEnd,
  onDelete,
  isStarting,
  isEnding,
  isDeleting,
  livekitRoomName,
  livekitUrl,
}: Props) {
  const canStart = debate.status === "pending";
  const canEnd = debate.status === "active";
  const canDelete = debate.status === "completed" || debate.status === "failed";
  const hasArtifacts = debate.status === "completed";

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
      <Card className="p-10">
        <div className="flex flex-wrap items-center gap-4">
          <Badge status={debate.status} />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
            Room {debate.livekit_room_name}
          </span>
        </div>
        <h1 className="mt-6 text-5xl font-headline font-extrabold tracking-tight text-on-background">
          {debate.title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-on-surface-variant">
          {debate.topic}
        </p>
        <div className="mt-8 rounded-2xl bg-surface-container-low p-6">
          <h2 className="text-xl font-headline font-extrabold text-on-background">Agent Prompt</h2>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-on-surface-variant">
            {debate.agent_prompt}
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <Button onClick={onStart} disabled={!canStart || isStarting}>
            {isStarting ? "Starting..." : "Start Debate"}
          </Button>
          <Button variant="secondary" onClick={onEnd} disabled={!canEnd || isEnding}>
            {isEnding ? "Ending..." : "End Debate"}
          </Button>
          {hasArtifacts ? (
            <>
              <Link
                to={`/transcript/${debate.id}`}
                className="inline-flex items-center justify-center rounded-full bg-surface-container px-6 py-3 font-headline font-bold text-on-surface"
              >
                View Transcript
              </Link>
              <Link
                to={`/analysis/${debate.id}`}
                className="inline-flex items-center justify-center rounded-full bg-surface-container px-6 py-3 font-headline font-bold text-on-surface"
              >
                View Analysis
              </Link>
            </>
          ) : (
            <>
              <span className="inline-flex items-center justify-center rounded-full bg-surface-container px-6 py-3 font-headline font-bold text-on-surface-variant opacity-60 cursor-not-allowed">
                View Transcript
              </span>
              <span className="inline-flex items-center justify-center rounded-full bg-surface-container px-6 py-3 font-headline font-bold text-on-surface-variant opacity-60 cursor-not-allowed">
                View Analysis
              </span>
            </>
          )}
          {canDelete ? (
            <Button variant="danger" onClick={onDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Debate"}
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-8">
          <h2 className="text-2xl font-headline font-extrabold text-on-background">Debate State</h2>
          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="font-bold uppercase tracking-wider text-on-surface-variant">Voice ID</dt>
              <dd className="mt-1 text-on-surface">{debate.agent_voice_id}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wider text-on-surface-variant">Created</dt>
              <dd className="mt-1 text-on-surface">{formatDate(debate.created_at)}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wider text-on-surface-variant">Started</dt>
              <dd className="mt-1 text-on-surface">{formatDate(debate.started_at)}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wider text-on-surface-variant">Ended</dt>
              <dd className="mt-1 text-on-surface">{formatDate(debate.ended_at)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-8 bg-primary text-on-primary">
          <h2 className="text-2xl font-headline font-extrabold">LiveKit Cloud</h2>
          <p className="mt-3 leading-relaxed text-on-primary/90">
            Bantr uses LiveKit Cloud for the live debate room. Your browser joins directly with
            a short-lived access token issued by the backend.
          </p>
          <div className="mt-5 text-sm">
            <p>Room: {livekitRoomName ?? debate.livekit_room_name}</p>
            <p className="break-all">URL: {livekitUrl ?? "Request token after activation"}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
