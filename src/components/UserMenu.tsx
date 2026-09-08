"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth-actions";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border border-rule-2 rounded-full pl-1.5 pr-3 py-1 bg-surface"
      >
        <span className="w-7 h-7 rounded-full bg-navy text-white text-[11px] font-semibold flex items-center justify-center font-[var(--font-display)]">
          {initials(name)}
        </span>
        <span className="text-[13px] font-medium hidden md:inline">{name}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 border border-rule rounded-lg bg-surface shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-rule">
            <p className="text-[13px] font-medium truncate">{name}</p>
            <p className="text-xs text-ink-3 truncate">{email}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="w-full text-left px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
