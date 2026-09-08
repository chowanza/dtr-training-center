"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Bot, User } from "lucide-react";
import { askKnowledgeBaseAction } from "@/lib/actions";
import type { KnowledgeCitation } from "@/lib/ai-chat";

interface ChatMessage {
  sender: "ai" | "user";
  text: string;
  citations?: KnowledgeCitation[];
  timestamp: string;
}

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatWidget({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "ai",
      text: `Hi ${userName.split(" ")[0]} — ask me anything about our processes, scripts, or policies. I only answer from what's actually published in the Training Center.`,
      timestamp: now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { sender: "user", text, timestamp: now() }]);
    setInputText("");
    setLoading(true);

    try {
      const result = await askKnowledgeBaseAction(text);
      setMessages((prev) => [...prev, { sender: "ai", text: result.answer, citations: result.citations, timestamp: now() }]);
    } catch (err) {
      console.error("Knowledge chat error:", err);
      setMessages((prev) => [...prev, { sender: "ai", text: "Something went wrong answering that — try again in a moment.", timestamp: now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-rule rounded-2xl bg-surface overflow-hidden shadow-sm">
      <div className="bg-navy-deep text-white p-5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-copper text-navy-deep">
            <Sparkles size={16} />
          </span>
          <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-copper font-semibold">
            Ask AI
          </span>
        </div>
        <h3 className="font-[var(--font-display)] font-bold text-lg text-white mt-1.5 mb-1">Company knowledge chat</h3>
        <p className="text-xs text-white/70 leading-relaxed max-w-2xl">
          Grounded in every published training module — it won&apos;t guess at things that aren&apos;t written down.
        </p>
      </div>

      <div className="p-5 space-y-4 max-h-[520px] overflow-y-auto bg-surface-2/40">
        {messages.map((m, i) => {
          const isAi = m.sender === "ai";
          return (
            <div key={i} className={`flex gap-3 max-w-[85%] ${isAi ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isAi ? "bg-copper-soft text-copper-deep border border-copper/30" : "bg-navy text-white"
                }`}
              >
                {isAi ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div>
                <div
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isAi ? "bg-surface border border-rule text-ink rounded-tl-xs shadow-xs" : "bg-navy text-white rounded-tr-xs"
                  }`}
                >
                  {m.text}
                </div>
                {m.citations && m.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 px-1">
                    {m.citations.map((c) => (
                      <span key={c.moduleId} className="text-[10.5px] font-[var(--font-mono)] px-2 py-0.5 rounded-full bg-copper-soft text-copper-deep border border-copper/30">
                        {c.moduleTitle}
                      </span>
                    ))}
                  </div>
                )}
                <div className={`text-[10.5px] font-[var(--font-mono)] text-ink-3 mt-1 px-1 ${isAi ? "text-left" : "text-right"}`}>{m.timestamp}</div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 max-w-[85%] mr-auto">
            <div className="w-8 h-8 rounded-full bg-copper-soft text-copper-deep border border-copper/30 flex items-center justify-center shrink-0 text-xs">
              <Bot size={16} />
            </div>
            <div className="bg-surface border border-rule p-3.5 rounded-2xl rounded-tl-xs text-xs text-ink-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-copper animate-bounce" />
              <span className="inline-block w-2 h-2 rounded-full bg-copper animate-bounce [animation-delay:0.2s]" />
              <span className="inline-block w-2 h-2 rounded-full bg-copper animate-bounce [animation-delay:0.4s]" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 bg-surface border-t border-rule">
        <div className="flex gap-2">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask about a process, script, or policy..."
            disabled={loading}
            className="flex-1 border border-rule-2 rounded-xl bg-surface px-4 py-2.5 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
          />
          <button type="submit" disabled={!inputText.trim() || loading} className="btn-primary flex items-center gap-1.5 px-4 text-sm disabled:opacity-40">
            <span>Send</span>
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
