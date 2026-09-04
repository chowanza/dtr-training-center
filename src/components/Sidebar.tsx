"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_ITEMS } from "./nav-config";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-rule bg-surface flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-rule">
          <Link href="/" className="flex items-baseline gap-1 font-[var(--font-display)] font-bold text-[15px] leading-none">
            <span className="text-navy">DREAM TEAM</span>
            <span className="text-copper">ROOFING</span>
          </Link>
          <button onClick={onClose} className="lg:hidden text-ink-3">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
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
