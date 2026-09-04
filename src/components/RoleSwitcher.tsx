"use client";

import { useTransition } from "react";
import { switchUser } from "@/lib/actions";
import type { User } from "@/lib/types";

export function RoleSwitcher({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 font-[var(--font-mono)] text-xs shrink-0">
      <span className="text-ink-3 uppercase tracking-wider hidden md:inline">Viewing as</span>
      <select
        defaultValue={currentUserId}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("userId", e.target.value);
          startTransition(() => {
            switchUser(fd);
          });
        }}
        className="border border-rule-2 bg-surface rounded px-2 py-1.5 text-ink disabled:opacity-50"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}
