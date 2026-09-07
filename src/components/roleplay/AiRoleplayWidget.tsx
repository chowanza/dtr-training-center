"use client";

import React, { useState, useRef, useEffect } from "react";
import type { AiRoleplayScenario, AiRoleplayMessage, AiRoleplaySession } from "@/lib/types";
import { submitRoleplayTurnAction, saveRoleplaySessionAction } from "@/lib/actions";
import {
  Sparkles,
  Send,
  RotateCcw,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface AiRoleplayWidgetProps {
  scenario: AiRoleplayScenario;
  existingSession?: AiRoleplaySession;
}

export function AiRoleplayWidget({ scenario, existingSession }: AiRoleplayWidgetProps) {
  const [messages, setMessages] = useState<AiRoleplayMessage[]>(() => {
    if (existingSession && existingSession.messages.length > 0) {
      return existingSession.messages;
    }
    return [
      {
        sender: "ai_customer",
        text: scenario.initialMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });

  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFinished, setIsFinished] = useState(Boolean(existingSession?.status === "completed"));
  const [evaluation, setEvaluation] = useState<{
    score?: number;
    passed?: boolean;
    feedback?: {
      summary: string;
      strengths: string[];
      improvements: string[];
      scriptAdherence: string;
    };
  }>(() => ({
    score: existingSession?.score,
    passed: existingSession?.passed,
    feedback: existingSession?.feedback,
  }));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const userTurnCount = messages.filter((m) => m.sender === "user_agent").length;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || loading || isFinished) return;

    const userMsg: AiRoleplayMessage = {
      sender: "user_agent",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText("");
    setLoading(true);

    try {
      const result = await submitRoleplayTurnAction({
        scenarioId: scenario.id,
        history: newHistory,
        userMessage: text,
      });

      const customerMsg: AiRoleplayMessage = {
        sender: "ai_customer",
        text: result.customerReply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const updatedHistory = [...newHistory, customerMsg];
      setMessages(updatedHistory);

      if (result.isFinished) {
        setIsFinished(true);
        setEvaluation({
          score: result.score,
          passed: result.passed,
          feedback: result.feedback,
        });

        // Persist session to database
        await saveRoleplaySessionAction({
          scenarioId: scenario.id,
          messages: updatedHistory,
          score: result.score,
          passed: result.passed,
          feedback: result.feedback,
        });
      }
    } catch (err) {
      console.error("Error in roleplay turn:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setMessages([
      {
        sender: "ai_customer",
        text: scenario.initialMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setIsFinished(false);
    setEvaluation({});
    setInputText("");
  };

  return (
    <div className="border border-rule rounded-2xl bg-surface overflow-hidden shadow-sm my-6">
      {/* Header */}
      <div className="bg-navy-deep text-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-copper text-navy-deep">
              <Sparkles size={16} />
            </span>
            <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-copper font-semibold">
              AI Roleplay Simulator
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-[var(--font-mono)] bg-white/10 px-2.5 py-1 rounded-full text-white/80">
              Turn {userTurnCount}/{scenario.maxTurns}
            </span>
            <span className="text-xs font-[var(--font-mono)] bg-white/10 px-2.5 py-1 rounded-full text-white/80">
              Pass: {scenario.passingScore}%
            </span>
          </div>
        </div>
        <h3 className="font-[var(--font-display)] font-bold text-lg text-white mb-1.5">
          {scenario.title}
        </h3>
        <p className="text-xs text-white/70 leading-relaxed max-w-2xl">
          {scenario.description}
        </p>

        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-copper-soft">
          <span className="font-semibold text-white">Customer:</span> {scenario.customerPersona}
        </div>
      </div>

      {/* Chat Thread */}
      <div className="p-5 space-y-4 max-h-[440px] overflow-y-auto bg-surface-2/40">
        {messages.map((m, i) => {
          const isCustomer = m.sender === "ai_customer";
          return (
            <div
              key={i}
              className={`flex gap-3 max-w-[85%] ${isCustomer ? "mr-auto" : "ml-auto flex-row-reverse"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isCustomer
                    ? "bg-copper-soft text-copper-deep border border-copper/30"
                    : "bg-navy text-white"
                }`}
              >
                {isCustomer ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div>
                <div
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                    isCustomer
                      ? "bg-surface border border-rule text-ink rounded-tl-xs shadow-xs"
                      : "bg-navy text-white rounded-tr-xs"
                  }`}
                >
                  {m.text}
                </div>
                <div
                  className={`text-[10.5px] font-[var(--font-mono)] text-ink-3 mt-1 px-1 ${
                    isCustomer ? "text-left" : "text-right"
                  }`}
                >
                  {m.timestamp}
                </div>
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
              <span>Customer is typing a reply...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Evaluation Scorecard (Shown when finished) */}
      {isFinished && evaluation.feedback && (
        <div className="p-6 border-t border-rule bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-rule">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-[var(--font-display)] font-bold text-xl ${
                  evaluation.passed
                    ? "bg-patina-soft text-patina border border-patina/30"
                    : "bg-brick-soft text-brick border border-brick/30"
                }`}
              >
                {evaluation.score}%
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-[var(--font-display)] font-bold text-base text-ink">
                    Roleplay Result
                  </span>
                  <span
                    className={`pill text-xs py-0.5 px-2.5 ${
                      evaluation.passed ? "p-good" : "p-bad"
                    }`}
                  >
                    {evaluation.passed ? "Passed" : "Needs Practice"}
                  </span>
                </div>
                <p className="text-xs text-ink-2 mt-0.5">
                  {evaluation.passed
                    ? "You successfully passed this call simulation."
                    : `You need at least ${scenario.passingScore}% to pass.`}
                </p>
              </div>
            </div>

            <button
              onClick={handleRestart}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              Retry Simulation
            </button>
          </div>

          <p className="text-sm text-ink-2 leading-relaxed mb-4 bg-surface-2 p-3.5 rounded-xl border border-rule">
            <strong>Evaluator Summary:</strong> {evaluation.feedback.summary}
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-patina/40 bg-patina-soft/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-patina font-semibold text-xs mb-2">
                <CheckCircle2 size={15} />
                Strengths
              </div>
              <ul className="space-y-1.5">
                {evaluation.feedback.strengths.map((s, idx) => (
                  <li key={idx} className="text-xs text-ink leading-relaxed">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-amber/40 bg-amber-soft/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber font-semibold text-xs mb-2">
                <AlertCircle size={15} />
                Areas for Improvement
              </div>
              <ul className="space-y-1.5">
                {evaluation.feedback.improvements.map((imp, idx) => (
                  <li key={idx} className="text-xs text-ink leading-relaxed">
                    • {imp}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Input Area (Active during conversation) */}
      {!isFinished && (
        <form onSubmit={handleSendMessage} className="p-4 bg-surface border-t border-rule">
          <div className="flex gap-2">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your reply as a Dream Team Roofing CSR..."
              disabled={loading}
              className="flex-1 border border-rule-2 rounded-xl bg-surface px-4 py-2.5 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="btn-primary flex items-center gap-1.5 px-4 text-sm disabled:opacity-40"
            >
              <span>Send</span>
              <Send size={14} />
            </button>
          </div>
          <p className="text-[11px] text-ink-3 mt-2 flex items-center justify-between">
            <span>
              💡 Use the official greeting, empathize with the emergency, and don&apos;t invent prices.
            </span>
            <span className="font-[var(--font-mono)]">
              Press Enter to send
            </span>
          </p>
        </form>
      )}
    </div>
  );
}
