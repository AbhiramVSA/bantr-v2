import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { getDebate, getTranscript } from "../services/debates";
import type { Debate, Transcript as TranscriptType } from "../types/debate";
import { ApiError } from "../types/api";

export function Transcript() {
  const { id = "" } = useParams();
  const [debate, setDebate] = useState<Debate | null>(null);
  const [transcript, setTranscript] = useState<TranscriptType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTranscript = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const debateResponse = await getDebate(id);
      setDebate(debateResponse);

      try {
        const transcriptResponse = await getTranscript(id);
        setTranscript(transcriptResponse);
      } catch (issue) {
        if (issue instanceof ApiError && issue.code === "TRANSCRIPT_NOT_FOUND") {
          setTranscript(null);
          return;
        }

        throw issue;
      }
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to load transcript.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTranscript();
  }, [loadTranscript]);

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">Transcript</h1>
        <p className="mt-3 text-lg text-on-surface-variant">
          Full structured transcript output for this Bantr session.
        </p>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorState message={error} onRetry={loadTranscript} /> : null}

      {transcript ? (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-8">
            <h2 className="text-2xl font-headline font-extrabold text-on-background">Full Text</h2>
            <p className="mt-6 whitespace-pre-wrap leading-relaxed text-on-surface-variant">
              {transcript.full_text}
            </p>
          </Card>
          <Card className="p-8">
            <h2 className="text-2xl font-headline font-extrabold text-on-background">Speaker Segments</h2>
            <div className="mt-6 space-y-4">
              {transcript.speaker_segments.map((segment, index) => (
                <div key={`${index}-${String(segment.speaker ?? "speaker")}`} className="rounded-2xl bg-surface-container-low p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                    {String(segment.speaker ?? `Speaker ${index + 1}`)}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface">
                    {String(segment.text ?? JSON.stringify(segment))}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {!loading && !error && !transcript ? (
        <Card className="p-8 text-on-surface-variant">
          {debate?.status === "completed"
            ? "Transcript is not available yet. Bantr may still be persisting the session output."
            : "Transcripts unlock after a debate has completed."}
        </Card>
      ) : null}
    </PageContainer>
  );
}
