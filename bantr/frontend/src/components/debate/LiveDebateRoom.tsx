import {
  BarVisualizer,
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { useMemo } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

type Props = {
  roomName: string;
  title: string;
  token: string | null;
  url: string | null;
  isEnding: boolean;
  onLeave: () => void;
  onEnd: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
};

type StatusPillProps = {
  label: string;
  tone: "primary" | "secondary" | "danger" | "muted";
};

function StatusPill({ label, tone }: StatusPillProps) {
  const toneClassName = {
    primary: "bg-primary text-on-primary",
    secondary: "bg-secondary-fixed text-on-secondary-fixed",
    danger: "bg-error text-on-error",
    muted: "bg-surface-container text-on-surface-variant",
  }[tone];

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${toneClassName}`}>
      {label}
    </span>
  );
}

function DebateRoomStage({
  roomName,
  onLeave,
  onEnd,
  isEnding,
}: {
  roomName: string;
  onLeave: () => void;
  onEnd: () => void;
  isEnding: boolean;
}) {
  const connectionState = useConnectionState();
  const {
    localParticipant,
    microphoneTrack,
    isMicrophoneEnabled,
    lastMicrophoneError,
  } = useLocalParticipant();
  const { agent, state: agentState, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const transcriptions = useTranscriptions();

  const connectionLabel =
    connectionState === ConnectionState.Connected
      ? "Connected"
      : connectionState === ConnectionState.Connecting
        ? "Connecting"
        : "Disconnected";
  const connectionTone: StatusPillProps["tone"] =
    connectionState === ConnectionState.Connected
      ? "secondary"
      : connectionState === ConnectionState.Connecting
        ? "primary"
        : "danger";

  const agentTone: StatusPillProps["tone"] =
    agentState === "failed"
      ? "danger"
      : audioTrack
        ? "secondary"
        : agent
          ? "primary"
          : "muted";
  const agentLabel = audioTrack
    ? `Agent ${agentState}`
    : agent
      ? "Agent warming up"
      : "Agent not connected";

  const recentLines = agentTranscriptions
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .slice(-4);
  const transcriptLines = useMemo(() => {
    return transcriptions
      .map((segment) => {
        const text = segment.text.trim();
        if (!text) {
          return null;
        }

        const identity = segment.participantInfo.identity;
        const speaker =
          identity === localParticipant.identity
            ? "You"
            : agent && identity === agent.identity
              ? agent.name || "Bantr Coach"
              : "Debate stream";

        return {
          key: `${segment.streamInfo.id}:${identity}`,
          text,
          speaker,
          isLocal: identity === localParticipant.identity,
          isAgent: Boolean(agent && identity === agent.identity),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(-8);
  }, [agent, localParticipant.identity, transcriptions]);
  const localMicTrackRef = microphoneTrack
    ? {
        participant: localParticipant,
        publication: microphoneTrack,
        source: microphoneTrack.source,
      }
    : undefined;

  async function handleToggleMicrophone() {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-surface-container px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Live Debate Room</p>
                <h1 className="mt-2 text-4xl font-headline font-extrabold tracking-tight text-on-background">
                  {roomName}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill label={connectionLabel} tone={connectionTone} />
                <StatusPill
                  label={agent ? `Agent ${agentState}` : "Agent not connected"}
                  tone={agentTone}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-8 py-8 md:grid-cols-2">
            <div className="rounded-[2rem] bg-surface-container-low p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">You</p>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-headline font-extrabold text-on-background">Microphone</h2>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                    {lastMicrophoneError
                      ? "Microphone permission failed. Re-enable access in your browser."
                      : isMicrophoneEnabled
                        ? "Your mic is live in the room."
                        : "Your mic is muted. Enable it when you are ready to speak."}
                  </p>
                </div>
                <StatusPill
                  label={isMicrophoneEnabled ? "Mic live" : "Mic muted"}
                  tone={isMicrophoneEnabled ? "secondary" : "muted"}
                />
              </div>
              <div className="mt-6 flex h-28 items-end justify-center rounded-[1.5rem] bg-white/70 px-4 py-5">
                {localMicTrackRef ? (
                  <BarVisualizer track={localMicTrackRef} barCount={7} className="flex h-full items-end gap-2">
                    <span className="w-3 rounded-full bg-primary/25 transition-colors data-[lk-highlighted=true]:bg-primary" />
                  </BarVisualizer>
                ) : (
                  <p className="text-sm font-medium text-on-surface-variant">Waiting for microphone track...</p>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] bg-primary p-6 text-on-primary">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-primary/70">Bantr Agent</p>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-headline font-extrabold">
                    {agent ? agent.name || "Bantr Coach" : "Waiting for agent"}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-on-primary/80">
                    {agent
                      ? audioTrack
                        ? "The agent is in the room and ready to debate."
                        : "The agent joined the room and is still preparing voice output."
                      : "The worker has been dispatched. This room will update as soon as the agent publishes presence."}
                  </p>
                </div>
                <StatusPill
                  label={audioTrack ? "Voice live" : agent ? "Warming up" : "Pending"}
                  tone={audioTrack ? "secondary" : agent ? "primary" : "muted"}
                />
              </div>
              <div className="mt-6 flex h-28 items-end justify-center rounded-[1.5rem] bg-white/10 px-4 py-5">
                {audioTrack ? (
                  <BarVisualizer track={audioTrack} barCount={7} className="flex h-full items-end gap-2">
                    <span className="w-3 rounded-full bg-white/25 transition-colors data-[lk-highlighted=true]:bg-secondary-fixed" />
                  </BarVisualizer>
                ) : (
                  <p className="text-sm font-medium text-on-primary/70">No agent audio track yet.</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Room actions</p>
          <h2 className="mt-3 text-3xl font-headline font-extrabold text-on-background">Debate controls</h2>
          <p className="mt-3 leading-relaxed text-on-surface-variant">
            Leave returns you to the debate detail page. End Debate closes the room for everyone and starts transcript finalization.
          </p>
          <div className="mt-8 grid gap-4">
            <Button variant="secondary" onClick={handleToggleMicrophone}>
              {isMicrophoneEnabled ? "Mute microphone" : "Enable microphone"}
            </Button>
            <Button variant="ghost" onClick={onLeave}>
              Leave room
            </Button>
            <Button variant="danger" onClick={onEnd} disabled={isEnding}>
              {isEnding ? "Ending debate..." : "End debate"}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Live transcript stream</p>
            <h2 className="mt-2 text-2xl font-headline font-extrabold text-on-background">Conversation</h2>
          </div>
          <StatusPill label={agentLabel} tone={agentTone} />
        </div>
        <div className="mt-6 space-y-3">
          {transcriptLines.length ? (
            transcriptLines.map((line) => (
              <div
                key={line.key}
                className={`rounded-2xl px-5 py-4 ${
                  line.isAgent
                    ? "bg-primary text-on-primary"
                    : line.isLocal
                      ? "bg-surface-container-low text-on-surface"
                      : "bg-surface-container text-on-surface"
                }`}
              >
                <p
                  className={`text-xs font-bold uppercase tracking-[0.18em] ${
                    line.isAgent ? "text-on-primary/70" : "text-on-surface-variant"
                  }`}
                >
                  {line.speaker}
                </p>
                <p className="mt-2 leading-relaxed">{line.text}</p>
              </div>
            ))
          ) : (
            <div className="rounded-[2rem] border-2 border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-10 text-center text-on-surface-variant">
              {recentLines.length
                ? "The agent is speaking. Your full conversation transcript will appear here as LiveKit emits transcription segments."
                : "The room is connected. Speak to interrupt or respond, and Bantr will stream both sides of the conversation here."}
            </div>
          )}
        </div>
      </Card>

      <RoomAudioRenderer />
    </div>
  );
}

export function LiveDebateRoom({
  roomName,
  title,
  token,
  url,
  isEnding,
  onLeave,
  onEnd,
  onDisconnected,
  onError,
}: Props) {
  if (!token || !url) {
    return (
      <Card className="p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Connecting</p>
        <h1 className="mt-3 text-4xl font-headline font-extrabold text-on-background">{title}</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-on-surface-variant">
          Bantr is preparing your LiveKit room token. Keep this page open while the browser joins the debate.
        </p>
      </Card>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect
      audio
      video={false}
      onDisconnected={onDisconnected}
      onError={onError}
      className="block"
    >
      <DebateRoomStage roomName={roomName} onLeave={onLeave} onEnd={onEnd} isEnding={isEnding} />
    </LiveKitRoom>
  );
}
