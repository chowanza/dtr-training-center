"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  linkHref: string | null;
  readAt: Date | null;
  createdAt: Date;
}

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({ notifications }: { notifications: NotificationRow[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleItemClick = (id: string, readAt: Date | null) => {
    if (readAt) return;
    const fd = new FormData();
    fd.set("id", id);
    markNotificationRead(fd);
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative w-9 h-9 rounded-full border border-rule-2 bg-surface flex items-center justify-center text-ink-2 hover:text-navy hover:border-navy"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brick text-white text-[10px] font-semibold flex items-center justify-center font-[var(--font-mono)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 border border-rule rounded-lg bg-surface shadow-lg z-50 max-h-[420px] overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-rule sticky top-0 bg-surface">
            <span className="text-[13px] font-medium">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={() => markAllNotificationsRead()} className="text-[11px] text-navy hover:underline font-medium">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-ink-3 px-3 py-6 text-center">Nothing yet.</p>
          ) : (
            <div className="divide-y divide-rule">
              {notifications.map((n) => {
                const content = (
                  <div className={`px-3 py-2.5 ${!n.readAt ? "bg-navy-soft/40" : ""}`}>
                    <div className="flex items-start gap-2">
                      {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-copper mt-1.5 shrink-0" />}
                      <div className={`min-w-0 ${n.readAt ? "pl-3.5" : ""}`}>
                        <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                        {n.body && <p className="text-[12px] text-ink-2 mt-0.5 leading-snug">{n.body}</p>}
                        <p className="text-[10.5px] text-ink-3 font-[var(--font-mono)] mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
                return n.linkHref ? (
                  <Link key={n.id} href={n.linkHref} onClick={() => handleItemClick(n.id, n.readAt)} className="block hover:bg-surface-2">
                    {content}
                  </Link>
                ) : (
                  <button key={n.id} type="button" onClick={() => handleItemClick(n.id, n.readAt)} className="block w-full text-left hover:bg-surface-2">
                    {content}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
