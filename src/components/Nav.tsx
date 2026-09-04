import Link from "next/link";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { RoleSwitcher } from "./RoleSwitcher";

const LINKS = [
  { href: "/builder", label: "Builder" },
  { href: "/learn", label: "Training" },
  { href: "/certify", label: "Certify" },
  { href: "/matrix", label: "Matrix" },
];

export async function Nav() {
  const user = await getCurrentUser();
  const users = getDb().users;

  return (
    <header className="border-b-2 border-ink bg-paper sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="font-[var(--font-display)] font-bold text-base sm:text-lg tracking-tight text-ink shrink-0">
          DTR <span className="text-copper hidden sm:inline">Training Center</span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto flex-1 min-w-0">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13px] font-medium text-ink-2 hover:text-copper px-2.5 py-1.5 rounded-full hover:bg-copper-soft transition-colors whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <RoleSwitcher users={users} currentUserId={user.id} />
      </div>
    </header>
  );
}
