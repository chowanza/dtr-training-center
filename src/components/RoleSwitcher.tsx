"use client";

import { useTransition } from "react";
import { switchUser } from "@/lib/actions";
import type { User } from "@/lib/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function RoleSwitcher({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();
  const current = users.find((u) => u.id === currentUserId) ?? users[0];

  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-2 border border-rule-2 rounded-full pl-1.5 pr-3 py-1 bg-surface">
        <span className="w-7 h-7 rounded-full bg-navy text-white text-[11px] font-semibold flex items-center justify-center font-[var(--font-display)]">
          {initials(current.name)}
        </span>
        <span className="text-[13px] font-medium hidden md:inline">{current.name}</span>
        <select
          aria-label="Viewing as"
          value={currentUserId}
          disabled={pending}
          onChange={(e) => {
            const fd = new FormData();
            fd.set("userId", e.target.value);
            startTransition(() => {
              switchUser(fd);
            });
          }}
          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-wait"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
