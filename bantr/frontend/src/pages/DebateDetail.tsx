import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DebateDetailPanel } from "../components/debate/DebateDetailPanel";
import { LiveKitRoomPanel } from "../components/debate/LiveKitRoomPanel";
import { PageContainer } from "../components/layout/PageContainer";
import { ErrorState } from "../components/ui/ErrorState";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";
import { useLiveKitSession } from "../hooks/useLiveKitSession";
import { deleteDebate, endDebate, getDebate, startDebate } from "../services/debates";
import type { Debate } from "../types/debate";
import { ApiError } from "../types/api";

export function DebateDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [debate, setDebate] = useState<Debate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const livekit = useLiveKitSession(id);
  const {
    prepare: prepareLiveKit,
    disconnect: disconnectLiveKit,
    status: livekitStatus,
    token: livekitToken,
    url: livekitUrl,
  } = livekit;

  const loadDebate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getDebate(id);
      setDebate(response);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to load debate.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDebate();
  }, [loadDebate]);

  useEffect(() => {
    if (!debate || debate.status !== "active" || livekitStatus !== "idle") {
      return;
    }

    void prepareLiveKit().catch((issue) => {
      setError(issue instanceof ApiError ? issue.message : "Unable to prepare the LiveKit session.");
    });
  }, [debate, livekitStatus, prepareLiveKit]);

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      const response = await startDebate(id);
      await prepareLiveKit({ token: response.livekit_token, url: response.livekit_url });
      setDebate((current) =>
        current
          ? { ...current, status: response.status, livekit_room_name: response.livekit_room_name }
          : current,
      );
      await loadDebate();
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to start debate.");
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
      disconnectLiveKit();
      await loadDebate();
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to end debate.");
    } finally {
      setEnding(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await deleteDebate(id);
      navigate("/dashboard");
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to delete debate.");
      setDeleting(false);
      setShowDeleteModal(false);
    }
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
      <DebateDetailPanel
        debate={debate}
        onStart={handleStart}
        onEnd={handleEnd}
        onDelete={() => setShowDeleteModal(true)}
        isStarting={starting}
        isEnding={ending}
        isDeleting={deleting}
        livekitRoomName={debate.livekit_room_name}
        livekitUrl={livekitUrl}
      />
      <LiveKitRoomPanel
        roomName={debate.livekit_room_name}
        token={livekitToken}
        url={livekitUrl}
        isActive={debate.status === "active"}
        onDisconnected={() => {
          disconnectLiveKit();
          void loadDebate();
        }}
        onError={(roomError) => setError(roomError.message)}
      />
      <Modal
        isOpen={showDeleteModal}
        title="Delete this debate?"
        description="This action is permanent and only available for completed or failed debates."
        confirmLabel="Delete"
        confirmVariant="danger"
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        isLoading={deleting}
      />
    </PageContainer>
  );
}
