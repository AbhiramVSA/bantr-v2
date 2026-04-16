import type { ChatMessage } from "../../types/chat";
import { formatDate } from "../../utils/format";

export function ChatThread({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-6">
      {messages.map((message) => {
        const isAssistant = message.role === "assistant";

        return (
          <div
            key={message.id}
            className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-3xl rounded-[2rem] px-6 py-5 sticker-shadow ${
                isAssistant
                  ? "bg-surface-container-lowest text-on-surface"
                  : "bg-primary text-on-primary"
              }`}
            >
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] opacity-70">
                {message.role}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">
                {formatDate(message.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
