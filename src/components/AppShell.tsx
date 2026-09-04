"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { User } from "@/lib/types";

export function AppShell({ users, currentUserId, children }: { users: User[]; currentUserId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const currentUser = users.find((u) => u.id === currentUserId) ?? users[0];

  return (
    <div className="flex h-full">
      <Sidebar open={open} onClose={() => setOpen(false)} currentUser={{ isAdmin: currentUser.isAdmin, isManager: currentUser.isManager }} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setOpen(true)} users={users} currentUserId={currentUserId} />
        <main className="flex-1 overflow-y-auto bg-paper">
          <div className="max-w-6xl mx-auto px-5 py-7 sm:px-8 sm:py-9">{children}</div>
        </main>
      </div>
    </div>
  );
}
