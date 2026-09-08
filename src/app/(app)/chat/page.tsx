import { requireCurrentUser } from "@/lib/session";
import { ChatWidget } from "@/components/chat/ChatWidget";

export default async function ChatPage() {
  const user = await requireCurrentUser();

  return (
    <div className="max-w-3xl">
      <h1 className="font-[var(--font-display)] font-bold text-[26px] tracking-tight mb-1">Ask AI</h1>
      <p className="text-ink-2 text-[14.5px] mb-6">Ask about any published process, script, or policy — answered straight from our own training content.</p>
      <ChatWidget userName={user.name} />
    </div>
  );
}
