"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_ITEMS, canAccess } from "./nav-config";

export function Sidebar({
  open,
  onClose,
  currentUser,
}: {
  open: boolean;
  onClose: () => void;
  currentUser: { isAdmin: boolean; isManager: boolean };
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => canAccess(item.access, currentUser));

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-rule bg-surface flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-rule">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <Image src="/dtr-logo.webp" alt="Dream Team Roofing" width={32} height={32} className="rounded-full shrink-0" />
            <span className="font-[var(--font-display)] font-bold text-[13px] leading-tight">
              <span className="block text-navy">DREAM TEAM</span>
              <span className="block text-copper">ROOFING</span>
            </span>
          </Link>
          <button onClick={onClose} className="lg:hidden text-ink-3">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={onClose} className={`sidebar-link ${active ? "active" : ""}`}>
                <Icon size={17} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-rule">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-wider text-ink-3">Training Center · v0 demo</p>
        </div>
      </aside>
    </>
  );
}
