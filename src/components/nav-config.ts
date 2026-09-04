import type { LucideIcon } from "lucide-react";
import { Home, FileText, Users, UsersRound, Award } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** "all" = every signed-in person, "staff" = manager or admin, "admin" = admin only */
  access: "all" | "staff" | "admin";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home, access: "all" },
  { href: "/builder", label: "Content", icon: FileText, access: "staff" },
  { href: "/people", label: "People", icon: Users, access: "all" },
  { href: "/groups", label: "Groups", icon: UsersRound, access: "all" },
  { href: "/certify", label: "Certify", icon: Award, access: "staff" },
];

export function canAccess(access: NavItem["access"], user: { isAdmin: boolean; isManager: boolean }) {
  if (access === "all") return true;
  if (access === "staff") return user.isAdmin || user.isManager;
  return user.isAdmin;
}
