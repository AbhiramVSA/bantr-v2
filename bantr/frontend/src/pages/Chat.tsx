import { useCallback, useEffect, useState } from "react";
import { ChatComposer } from "../components/chat/ChatComposer";
import { ChatThread } from "../components/chat/ChatThread";
import { PageContainer } from "../components/layout/PageContainer";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Spinner } from "../components/ui/Spinner";
import { clearChatHistory, getChatHistory, sendChatMessage } from "../services/chat";
import type { ChatContextDebate, ChatMessage } from "../types/chat";
import { ApiError } from "../types/api";

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contexts, setContexts] = useState<ChatContextDebate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getChatHistory();
      setMessages(response);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to load chat history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function handleSend(message: string) {
    setSending(true);
    setError("");
    try {
      const response = await sendChatMessage(message);
      setContexts(response.context_debates);
      const history = await getChatHistory();
      setMessages(history);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      await clearChatHistory();
      setMessages([]);
      setContexts([]);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to clear chat history.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <PageContainer className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-background">Bantr Coach Chat</h1>
          <p className="mt-3 text-lg text-on-surface-variant">Persistent coaching thread grounded in your debate history.</p>
        </div>
        <Button variant="ghost" onClick={handleClear} disabled={clearing || !messages.length}>
          {clearing ? "Clearing..." : "Clear History"}
        </Button>
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorState message={error} onRetry={loadMessages} /> : null}

      {contexts.length ? (
        <Card className="p-6">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">Context debates</div>
          <div className="mt-4 flex flex-wrap gap-3">
            {contexts.map((context) => (
              <span key={context.id} className="rounded-full bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container">
                {context.title}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      {!loading && !messages.length ? (
        <EmptyState title="No chat history yet" description="Ask Bantr Coach to review your rhetoric, summaries, or next debate strategy." />
      ) : null}

      {messages.length ? <ChatThread messages={messages} /> : null}
      <ChatComposer onSend={handleSend} isSending={sending} />
    </PageContainer>
  );
}
