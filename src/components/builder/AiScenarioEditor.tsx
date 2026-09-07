"use client";

import React, { useState } from "react";
import type { AiRoleplayScenario, Topic } from "@/lib/types";
import { createAiScenario, deleteAiScenario } from "@/lib/actions";
import { Sparkles, Trash2, Bot, Plus } from "lucide-react";

interface AiScenarioEditorProps {
  moduleVersionId: string;
  moduleId: string;
  topics: Topic[];
  scenarios: AiRoleplayScenario[];
}

export function AiScenarioEditor({
  moduleVersionId,
  moduleId,
  topics,
  scenarios,
}: AiScenarioEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-copper-soft text-copper-deep">
            <Sparkles size={18} />
          </div>
          <h2 className="font-[var(--font-display)] font-semibold text-lg text-ink">
            AI Roleplay Simulator
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          <Plus size={14} />
          {isOpen ? "Close Form" : "+ Create Simulation"}
        </button>
      </div>
      <p className="text-ink-2 text-[13.5px] mb-4">
        Design interactive scenarios where employees practice difficult calls with AI-simulated customers before talking to real ones.
      </p>

      {/* New Scenario Form */}
      {isOpen && (
        <form
          action={async (formData) => {
            await createAiScenario(formData);
            setIsOpen(false);
          }}
          className="border border-navy/30 bg-surface rounded-2xl p-6 mb-6 shadow-xs space-y-4"
        >
          <input type="hidden" name="moduleVersionId" value={moduleVersionId} />
          <input type="hidden" name="moduleId" value={moduleId} />

          <div className="border-b border-rule pb-3">
            <h3 className="font-[var(--font-display)] font-bold text-base text-navy">
              Configure New Practice Scenario
            </h3>
            <p className="text-xs text-ink-3">
              Define the customer&apos;s personality and the criteria the AI will use to evaluate the agent.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Scenario Title *
              </label>
              <input
                name="title"
                placeholder="E.g. Angry customer over a delayed crew..."
                required
                className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Attach to Topic (Optional)
              </label>
              <select
                name="topicId"
                className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-2 text-sm"
              >
                <option value="">Whole Module (General)</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Description for the Learner
            </label>
            <input
              name="description"
              placeholder="Brief instructions on what the learner should accomplish in this simulation..."
              required
              className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-2 text-sm"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Customer Persona *
              </label>
              <textarea
                name="customerPersona"
                rows={3}
                placeholder="E.g. Mrs. Jenkins, 55, furious because a shingle blew off overnight and water ruined her Persian rug..."
                required
                className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Customer&apos;s Opening Message *
              </label>
              <textarea
                name="initialMessage"
                rows={3}
                placeholder="E.g. Good morning! I've been waiting two hours for the technician you promised at 8:00 AM. Is this the kind of service you provide?!"
                required
                className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Customer Behavior Instructions for the AI *
            </label>
            <textarea
              name="systemPrompt"
              rows={3}
              placeholder="Instructions on how the customer should react if the agent uses the right script, or makes mistakes..."
              required
              className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Automatic Grading Rubric
            </label>
            <textarea
              name="rubricPrompt"
              rows={2}
              placeholder="Grading criteria: professional greeting, empathy, confirms address, doesn't promise a time without checking dispatch..."
              className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Turn Limit
              </label>
              <input
                type="number"
                name="maxTurns"
                defaultValue={5}
                min={3}
                max={10}
                className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Minimum Passing Score (%)
              </label>
              <input
                type="number"
                name="passingScore"
                defaultValue={80}
                min={50}
                max={100}
                className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-rule">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs">
              Save Simulation
            </button>
          </div>
        </form>
      )}

      {/* List of existing scenarios */}
      {scenarios.length === 0 ? (
        <div className="border border-dashed border-rule-2 rounded-xl p-6 text-center bg-surface-2/30">
          <Bot size={24} className="mx-auto text-ink-3 mb-2" />
          <p className="text-sm text-ink-2 font-medium">No AI simulations created yet</p>
          <p className="text-xs text-ink-3 mt-0.5">
            Create a simulation so learners can practice objection and emergency calls.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className="border border-rule rounded-xl bg-surface p-4 flex items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-copper-soft text-copper-deep">
                    <Sparkles size={13} />
                  </span>
                  <h4 className="font-semibold text-sm text-ink">{s.title}</h4>
                  <span className="pill text-[10px] p-indigo py-0 px-2">
                    {s.maxTurns} turns · Pass {s.passingScore}%
                  </span>
                </div>
                <p className="text-xs text-ink-2">{s.description}</p>
                <div className="text-[11.5px] text-ink-3 bg-surface-2 p-2 rounded-lg mt-2">
                  <strong>Customer opening:</strong> &quot;{s.initialMessage}&quot;
                </div>
              </div>

              <form action={deleteAiScenario}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="moduleId" value={moduleId} />
                <button
                  type="submit"
                  className="text-xs text-brick hover:underline p-1.5 rounded hover:bg-brick-soft transition-colors"
                  title="Remove simulation"
                >
                  <Trash2 size={15} />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
