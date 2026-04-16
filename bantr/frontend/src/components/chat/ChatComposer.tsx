import { useState, type FormEvent } from "react";

export function ChatComposer({
  onSend,
  isSending,
}: {
  onSend: (message: string) => Promise<void>;
  isSending: boolean;
}) {
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    await onSend(trimmed);
    setMessage("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] bg-surface-container-lowest p-4 sticker-shadow">
      <div className="flex flex-col gap-4 md:flex-row">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="min-h-[120px] flex-1 rounded-[1.5rem] border-none bg-surface-container p-5 text-on-background outline-none"
          placeholder="Ask Bantr Coach about your debates, rhetoric, or next move."
        />
        <button
          type="submit"
          disabled={isSending || !message.trim()}
          className="rounded-full bg-primary px-8 py-4 font-headline font-bold uppercase tracking-[0.1em] text-on-primary disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
