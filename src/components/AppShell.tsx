"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  linkHref: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export function AppShell({
  currentUser,
  notifications,
  children,
}: {
  currentUser: { name: string; email: string; accessRole: "admin" | "editor" | "learner" };
  notifications: NotificationRow[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full">
      <Sidebar open={open} onClose={() => setOpen(false)} currentUser={{ accessRole: currentUser.accessRole }} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setOpen(true)} name={currentUser.name} email={currentUser.email} notifications={notifications} />
        <main className="flex-1 overflow-y-auto bg-paper">
          <div className="max-w-6xl mx-auto px-5 py-7 sm:px-8 sm:py-9">{children}</div>
        </main>
      </div>
    </div>
  );
}
