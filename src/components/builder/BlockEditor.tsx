"use client";

import React, { useState } from "react";
import type { ContentBlock, ContentBlockType } from "@/lib/types";
import { addContentBlock, deleteContentBlock } from "@/lib/actions";
import { Video, FileText, Volume2, AlertTriangle, CheckSquare, Trash2 } from "lucide-react";

interface BlockEditorProps {
  stepId: string;
  moduleId: string;
  blocks: ContentBlock[];
}

export function BlockEditor({ stepId, moduleId, blocks }: BlockEditorProps) {
  const [addingType, setAddingType] = useState<ContentBlockType | null>(null);

  return (
    <div className="mt-3 pt-3 border-t border-rule">
      <div className="flex items-center justify-between mb-2">
        <h5 className="font-[var(--font-mono)] text-[10.5px] uppercase tracking-wider text-ink-3 font-semibold">
          Multimedia Content Blocks ({blocks.length})
        </h5>

        {/* Add Block Dropdown */}
        <div className="relative inline-block text-left">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAddingType(addingType === "video" ? null : "video")}
              className="text-xs btn-secondary py-1 px-2.5 flex items-center gap-1"
            >
              <Video size={12} className="text-navy" />
              + Video
            </button>
            <button
              type="button"
              onClick={() => setAddingType(addingType === "callout" ? null : "callout")}
              className="text-xs btn-secondary py-1 px-2.5 flex items-center gap-1"
            >
              <AlertTriangle size={12} className="text-amber" />
              + Callout/Script
            </button>
            <button
              type="button"
              onClick={() => setAddingType(addingType === "audio" ? null : "audio")}
              className="text-xs btn-secondary py-1 px-2.5 flex items-center gap-1"
            >
              <Volume2 size={12} className="text-copper-deep" />
              + Audio
            </button>
            <button
              type="button"
              onClick={() => setAddingType(addingType === "file" ? null : "file")}
              className="text-xs btn-secondary py-1 px-2.5 flex items-center gap-1"
            >
              <FileText size={12} className="text-patina" />
              + PDF File
            </button>
            <button
              type="button"
              onClick={() => setAddingType(addingType === "checklist" ? null : "checklist")}
              className="text-xs btn-secondary py-1 px-2.5 flex items-center gap-1"
            >
              <CheckSquare size={12} className="text-indigo" />
              + Checklist
            </button>
          </div>
        </div>
      </div>

      {/* Adding Form */}
      {addingType && (
        <form
          action={async (formData) => {
            await addContentBlock(formData);
            setAddingType(null);
          }}
          className="border border-navy/30 bg-navy-soft/20 rounded-xl p-4 my-3 space-y-3"
        >
          <input type="hidden" name="stepId" value={stepId} />
          <input type="hidden" name="moduleId" value={moduleId} />
          <input type="hidden" name="type" value={addingType} />

          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-navy uppercase font-[var(--font-mono)]">
              New Block: {addingType.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={() => setAddingType(null)}
              className="text-xs text-ink-3 hover:text-brick"
            >
              Cancel
            </button>
          </div>

          <input
            name="title"
            placeholder={
              addingType === "video"
                ? "Video title (e.g. How to book a lead in 3 min)..."
                : addingType === "callout"
                ? "Callout heading (e.g. Golden Rule / Official Script)..."
                : addingType === "audio"
                ? "Call title (e.g. Real storm-lead call audio)..."
                : addingType === "file"
                ? "Document name (e.g. GAF Warranty Manual)..."
                : "Verification checklist title..."
            }
            required
            className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-1.5 text-sm"
          />

          {addingType === "callout" && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-ink-2 font-medium">Type:</span>
              <select
                name="calloutType"
                defaultValue="tip"
                className="border border-rule-2 bg-surface rounded-lg px-2.5 py-1 text-xs"
              >
                <option value="tip">Practical Tip</option>
                <option value="warning">Warning / Common Mistake</option>
                <option value="rule">Company Golden Rule</option>
                <option value="script">Recommended Script</option>
              </select>
            </div>
          )}

          {(addingType === "video" || addingType === "audio" || addingType === "file") && (
            <div className="flex gap-2">
              <input
                name="mediaUrl"
                placeholder={
                  addingType === "video"
                    ? "Video URL (YouTube, Loom, or Vimeo)..."
                    : addingType === "audio"
                    ? "MP3/audio file URL..."
                    : "File URL or download link..."
                }
                required
                className="flex-1 border border-rule-2 rounded-lg bg-surface px-3 py-1.5 text-xs"
              />
              {addingType === "file" && (
                <>
                  <input
                    name="fileFormat"
                    placeholder="PDF"
                    defaultValue="PDF"
                    className="w-20 border border-rule-2 rounded-lg bg-surface px-2 py-1.5 text-xs text-center uppercase"
                  />
                  <input
                    name="fileSize"
                    placeholder="1.5 MB"
                    className="w-24 border border-rule-2 rounded-lg bg-surface px-2 py-1.5 text-xs text-center"
                  />
                </>
              )}
              {addingType === "audio" && (
                <input
                  name="fileSize"
                  placeholder="3:45 min"
                  className="w-24 border border-rule-2 rounded-lg bg-surface px-2 py-1.5 text-xs text-center"
                />
              )}
            </div>
          )}

          <textarea
            name="body"
            placeholder={
              addingType === "callout"
                ? "Write the exact warning or script text here..."
                : "Description or extra instructions for this block..."
            }
            rows={2}
            className="w-full border border-rule-2 rounded-lg bg-surface px-3 py-2 text-sm"
          />

          <button type="submit" className="btn-primary text-xs">
            Save Block
          </button>
        </form>
      )}

      {/* List of existing blocks */}
      {blocks.length === 0 ? (
        <p className="text-xs text-ink-3 italic py-1">
          No multimedia blocks attached to this step yet.
        </p>
      ) : (
        <div className="space-y-2 mt-2">
          {blocks.map((b) => (
            <div
              key={b.id}
              className="border border-rule rounded-lg bg-surface p-3 flex items-start justify-between gap-3 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`pill py-0 px-2 text-[10px] font-semibold uppercase ${
                      b.type === "video"
                        ? "p-indigo"
                        : b.type === "callout"
                        ? "p-amber"
                        : b.type === "audio"
                        ? "p-good"
                        : "p-neutral"
                    }`}
                  >
                    {b.type}
                  </span>
                  <span className="font-semibold text-ink truncate">{b.title}</span>
                </div>
                {b.body && <p className="text-ink-2 truncate max-w-md">{b.body}</p>}
                {b.mediaUrl && (
                  <span className="text-navy truncate block mt-0.5 max-w-sm opacity-80">
                    🔗 {b.mediaUrl}
                  </span>
                )}
              </div>

              <form action={deleteContentBlock}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="moduleId" value={moduleId} />
                <button
                  type="submit"
                  className="text-brick hover:underline p-1 rounded hover:bg-brick-soft transition-colors"
                  title="Remove block"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
