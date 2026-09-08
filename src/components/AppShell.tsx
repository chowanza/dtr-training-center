"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({
  currentUser,
  children,
}: {
  currentUser: { name: string; email: string; accessRole: "admin" | "editor" | "learner" };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full">
      <Sidebar open={open} onClose={() => setOpen(false)} currentUser={{ accessRole: currentUser.accessRole }} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setOpen(true)} name={currentUser.name} email={currentUser.email} />
        <main className="flex-1 overflow-y-auto bg-paper">
          <div className="max-w-6xl mx-auto px-5 py-7 sm:px-8 sm:py-9">{children}</div>
        </main>
      </div>
    </div>
  );
}
