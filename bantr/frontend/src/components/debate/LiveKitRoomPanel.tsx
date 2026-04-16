import {
  AudioConference,
  LiveKitRoom,
  RoomAudioRenderer,
} from "@livekit/components-react";
import type { DisconnectReason } from "livekit-client";
import { Card } from "../ui/Card";

type Props = {
  roomName: string;
  token: string | null;
  url: string | null;
  isActive: boolean;
  onConnected?: () => void;
  onDisconnected?: (reason?: DisconnectReason) => void;
  onError?: (error: Error) => void;
};

export function LiveKitRoomPanel({
  roomName,
  token,
  url,
  isActive,
  onConnected,
  onDisconnected,
  onError,
}: Props) {
  if (!isActive) {
    return (
      <Card className="p-8">
        <h2 className="text-2xl font-headline font-extrabold text-on-background">LiveKit Room</h2>
        <p className="mt-3 leading-relaxed text-on-surface-variant">
          Start the debate to connect your browser to the Bantr room in LiveKit Cloud.
        </p>
      </Card>
    );
  }

  if (!token || !url) {
    return (
      <Card className="p-8">
        <h2 className="text-2xl font-headline font-extrabold text-on-background">LiveKit Room</h2>
        <p className="mt-3 leading-relaxed text-on-surface-variant">
          Bantr is preparing your room connection. Keep this page open while your LiveKit session comes online.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-surface-container px-8 py-6">
        <h2 className="text-2xl font-headline font-extrabold text-on-background">LiveKit Room</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Connected to <span className="font-bold text-on-background">{roomName}</span>. Allow microphone access to debate live with the agent.
        </p>
      </div>
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        audio
        video={false}
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        onError={onError}
        className="lk-theme-default bg-surface-container-low"
      >
        <div className="min-h-[480px] bg-surface-container-low p-4">
          <AudioConference />
          <RoomAudioRenderer />
        </div>
      </LiveKitRoom>
    </Card>
  );
}
