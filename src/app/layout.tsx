import type { Metadata } from "next";
import { Inter, Poppins, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const poppins = Poppins({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const inter = Inter({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "DTR Training Center",
  description: "Dream Team Roofing certification system — demo build.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const users = getDb().users;

  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} ${plexMono.variable} h-full`}>
      <body className="h-full bg-paper text-ink">
        <AppShell users={users} currentUserId={user.id}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
