import type { ChatBubble } from "@/components/bedroom-session/conversation-card";
import { cn } from "@/lib/utils";

export function V3ConversationThread({
  bubbles,
  thinking,
  className,
}: {
  bubbles: ChatBubble[];
  thinking?: boolean;
  className?: string;
}) {
  if (!bubbles.length && !thinking) return null;

  return (
    <div className={cn("v3-thread", className)} aria-label="Conversation">
      {bubbles.map((b) => (
        <div
          key={b.id}
          className={cn("v3-thread-bubble", b.role === "user" ? "is-user" : "is-sift")}
        >
          {b.role === "sift" ? (
            <p className="v3-thread-label">Sift</p>
          ) : null}
          <p className="v3-thread-text">{b.text}</p>
        </div>
      ))}
      {thinking ? (
        <p className="v3-thread-thinking">Sift is listening…</p>
      ) : null}
    </div>
  );
}
