"use client";

import { useRouter } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  linkHref: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export function TopBar({
  onMenuClick,
  name,
  email,
  notifications,
}: {
  onMenuClick: () => void;
  name: string;
  email: string;
  notifications: NotificationRow[];
}) {
  const router = useRouter();

  return (
    <header className="h-16 border-b border-rule bg-surface flex items-center gap-3 px-4 sm:px-6 shrink-0">
      <button onClick={onMenuClick} className="lg:hidden text-ink-2">
        <Menu size={20} />
      </button>
      <form
        className="flex-1 max-w-md relative hidden sm:block"
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q");
          router.push(`/builder${q ? `?q=${encodeURIComponent(String(q))}` : ""}`);
        }}
      >
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          name="q"
          placeholder="Search modules…"
          className="w-full border border-rule-2 rounded-full bg-surface-2 pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:border-navy focus:bg-surface"
        />
      </form>
      <div className="flex-1 sm:hidden" />
      <NotificationBell notifications={notifications} />
      <UserMenu name={name} email={email} />
    </header>
  );
}
