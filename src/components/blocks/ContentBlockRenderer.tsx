"use client";

import React, { useState } from "react";
import type { ContentBlock } from "@/lib/types";
import {
  Lightbulb,
  AlertTriangle,
  ShieldAlert,
  MessageSquareQuote,
  FileText,
  Download,
  Volume2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toEmbedUrl } from "@/lib/embed";

export function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "text":
      return <TextBlock block={block} />;
    case "callout":
      return <CalloutBlock block={block} />;
    case "video":
      return <VideoBlock block={block} />;
    case "audio":
      return <AudioBlock block={block} />;
    case "file":
      return <FileBlock block={block} />;
    case "checklist":
      return <ChecklistBlock block={block} />;
    default:
      return null;
  }
}

function TextBlock({ block }: { block: ContentBlock }) {
  if (!block.body && !block.title) return null;
  return (
    <div className="space-y-1.5 text-[14.5px] leading-relaxed text-ink">
      {block.title && <h4 className="font-semibold text-base text-ink">{block.title}</h4>}
      {block.body && <p className="whitespace-pre-wrap">{block.body}</p>}
    </div>
  );
}

function CalloutBlock({ block }: { block: ContentBlock }) {
  const type = block.calloutType || "tip";

  const config = {
    tip: {
      icon: Lightbulb,
      containerCls: "bg-indigo-soft border-indigo text-navy-deep",
      iconCls: "text-indigo",
      label: "TIP",
    },
    warning: {
      icon: AlertTriangle,
      containerCls: "bg-amber-soft border-amber text-navy-deep",
      iconCls: "text-amber",
      label: "WARNING / COMMON MISTAKE",
    },
    rule: {
      icon: ShieldAlert,
      containerCls: "bg-brick-soft border-brick text-navy-deep",
      iconCls: "text-brick",
      label: "COMPANY GOLDEN RULE",
    },
    script: {
      icon: MessageSquareQuote,
      containerCls: "bg-patina-soft border-patina text-navy-deep",
      iconCls: "text-patina",
      label: "RECOMMENDED SCRIPT",
    },
  }[type];

  const Icon = config.icon;

  return (
    <div className={`border-l-4 rounded-r-xl p-4 my-3 border ${config.containerCls}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={16} className={config.iconCls} />
        <span className="font-[var(--font-mono)] text-[10.5px] uppercase font-bold tracking-wider opacity-80">
          {block.title || config.label}
        </span>
      </div>
      {block.body && <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{block.body}</p>}
    </div>
  );
}

function VideoBlock({ block }: { block: ContentBlock }) {
  const url = block.mediaUrl || "";
  const embedUrl = toEmbedUrl(url);

  return (
    <div className="border border-rule rounded-xl overflow-hidden bg-surface-2 my-4 shadow-xs">
      {block.title && (
        <div className="px-4 py-2.5 border-b border-rule bg-surface flex items-center justify-between">
          <span className="font-semibold text-xs text-ink font-[var(--font-display)]">{block.title}</span>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-navy hover:underline inline-flex items-center gap-1">
              Open source <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
      {embedUrl ? (
        <div className="aspect-video w-full">
          <iframe
            src={embedUrl}
            title={block.title || "Video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>
      ) : url ? (
        <div className="p-4">
          <video controls className="w-full rounded-lg bg-black aspect-video">
            <source src={url} type="video/mp4" />
            Your browser doesn&apos;t support HTML5 video playback.
          </video>
        </div>
      ) : (
        <div className="p-4 text-xs text-ink-3 italic bg-surface-2">
          Video pending upload by the instructor.
        </div>
      )}
      {block.body && (
        <div className="p-3 bg-surface border-t border-rule text-xs text-ink-2">
          {block.body}
        </div>
      )}
    </div>
  );
}

function AudioBlock({ block }: { block: ContentBlock }) {
  return (
    <div className="border border-rule rounded-xl bg-surface p-4 my-3 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-copper-soft text-copper-deep flex items-center justify-center shrink-0 mt-0.5">
        <Volume2 size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="font-semibold text-sm text-ink truncate">{block.title || "Lesson audio"}</h4>
          {block.fileSize && (
            <span className="font-[var(--font-mono)] text-[11px] text-ink-3 shrink-0">
              {block.fileSize}
            </span>
          )}
        </div>
        {block.body && <p className="text-xs text-ink-2 mb-3">{block.body}</p>}
        {block.mediaUrl ? (
          <audio controls className="w-full h-9">
            <source src={block.mediaUrl} />
            Your browser doesn&apos;t support audio playback.
          </audio>
        ) : (
          <div className="text-xs text-ink-3 italic bg-surface-2 p-2 rounded">
            Audio file pending upload by the instructor.
          </div>
        )}
      </div>
    </div>
  );
}

function FileBlock({ block }: { block: ContentBlock }) {
  return (
    <div className="border border-rule rounded-xl bg-surface p-4 my-3 flex items-center justify-between gap-4 hover:border-rule-2 transition-colors">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-navy-soft text-navy flex items-center justify-center shrink-0">
          <FileText size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-ink truncate">{block.title || "Attached document"}</h4>
            <span className="pill text-[10px] py-0 px-2 uppercase bg-surface-2 border-rule text-ink-2">
              {block.fileFormat || "PDF"}
            </span>
          </div>
          <p className="text-xs text-ink-2 truncate mt-0.5">{block.body || "Reference document"}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {block.fileSize && (
          <span className="font-[var(--font-mono)] text-xs text-ink-3 hidden sm:inline-block">
            {block.fileSize}
          </span>
        )}
        {block.mediaUrl ? (
          <a
            href={block.mediaUrl}
            download={block.title}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download size={13} />
            Download
          </a>
        ) : (
          <span className="text-xs text-ink-3 italic">Pending upload</span>
        )}
      </div>
    </div>
  );
}

function ChecklistBlock({ block }: { block: ContentBlock }) {
  const [items, setItems] = useState(
    block.checklistItems || [
      { id: "1", text: "First step completed", defaultChecked: false },
    ]
  );
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (block.checklistItems || []).forEach((i) => {
      if (i.defaultChecked) initial[i.id] = true;
    });
    return initial;
  });

  const toggle = (id: string) => {
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const total = items.length;
  const done = items.filter((i) => checkedMap[i.id]).length;
  const allDone = total > 0 && done === total;

  return (
    <div className="border border-rule rounded-xl bg-surface p-4 my-3">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-rule">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className={allDone ? "text-patina" : "text-copper"} />
          <span className="font-semibold text-xs uppercase tracking-wider text-ink font-[var(--font-mono)]">
            {block.title || "Verification Checklist"}
          </span>
        </div>
        <span className="font-[var(--font-mono)] text-xs text-ink-3">
          {done}/{total} done
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <label
            key={item.id}
            className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-sm ${
              checkedMap[item.id] ? "bg-patina-soft/40 text-ink line-through opacity-80" : "hover:bg-surface-2 text-ink"
            }`}
          >
            <input
              type="checkbox"
              checked={!!checkedMap[item.id]}
              onChange={() => toggle(item.id)}
              className="mt-1 accent-patina rounded"
            />
            <span className="flex-1">{item.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
