import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DebateDetailPanel } from "../components/debate/DebateDetailPanel";
import { PageContainer } from "../components/layout/PageContainer";
import { ErrorState } from "../components/ui/ErrorState";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";
import { useDebate } from "../hooks/useDebate";
import { deleteDebate, endDebate, startDebate } from "../services/debates";
import { ApiError } from "../types/api";

export function DebateDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { debate, setDebate, loading, error, setError, loadDebate } = useDebate(id);

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      const response = await startDebate(id);
      setDebate((current) =>
        current
          ? { ...current, status: response.status, livekit_room_name: response.livekit_room_name }
          : current,
      );
      navigate(`/debates/${id}/live`);
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
        onJoinLive={() => navigate(`/debates/${id}/live`)}
        isStarting={starting}
        isEnding={ending}
        isDeleting={deleting}
        livekitRoomName={debate.livekit_room_name}
        livekitUrl={null}
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
