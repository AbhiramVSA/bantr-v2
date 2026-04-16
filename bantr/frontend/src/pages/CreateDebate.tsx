import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Input";
import { createDebate } from "../services/debates";
import { ApiError } from "../types/api";

export function CreateDebate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentVoiceId, setAgentVoiceId] = useState("demo-voice");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const debate = await createDebate({
        title,
        topic,
        agent_prompt: agentPrompt,
        agent_voice_id: agentVoiceId,
      });
      navigate(`/debates/${debate.id}`);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to create debate.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <div className="mb-12">
        <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">Create a Debate</h1>
        <p className="mt-3 text-lg text-on-surface-variant">
          Spin up a new Bantr room with your debate topic, AI persona, and voice configuration.
        </p>
      </div>
      <Card className="p-10">
        {error ? <ErrorState message={error} /> : null}
        <form className="mt-6 grid gap-8 lg:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <label className="mb-3 block text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Title</label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Universal Basic Income Finals" />
            </div>
            <div>
              <label className="mb-3 block text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Agent Voice ID</label>
              <Input value={agentVoiceId} onChange={(event) => setAgentVoiceId(event.target.value)} placeholder="demo-voice" />
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <label className="mb-3 block text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Topic</label>
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="min-h-[140px] w-full rounded-[1.5rem] border-none bg-surface-container-low p-5 text-on-background outline-none"
                placeholder="Describe the debate topic, resolution, and ground rules."
              />
            </div>
            <div>
              <label className="mb-3 block text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Agent Prompt</label>
              <textarea
                value={agentPrompt}
                onChange={(event) => setAgentPrompt(event.target.value)}
                className="min-h-[180px] w-full rounded-[1.5rem] border-none bg-surface-container-low p-5 text-on-background outline-none"
                placeholder="Give Bantr Coach the role, tone, and rhetorical style to argue with."
              />
            </div>
          </div>
          <div className="lg:col-span-2 flex justify-end">
            <Button type="submit" className="px-10 py-4 text-sm uppercase tracking-[0.15em]" disabled={submitting}>
              {submitting ? "Creating..." : "Create Debate"}
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}
