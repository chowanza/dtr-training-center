import { AppShell } from "@/components/AppShell";
import { requireCurrentUser } from "@/lib/session";

export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  const user = await requireCurrentUser();

  return (
    <AppShell currentUser={{ name: user.name, email: user.email, accessRole: user.accessRole }}>
      {children}
    </AppShell>
  );
}
