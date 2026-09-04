import type { LucideIcon } from "lucide-react";
import { Home, FileText, Users, Award } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/builder", label: "Content", icon: FileText },
  { href: "/people", label: "People", icon: Users },
  { href: "/certify", label: "Certify", icon: Award },
];
