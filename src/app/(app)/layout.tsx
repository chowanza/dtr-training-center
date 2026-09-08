import { AppShell } from "@/components/AppShell";
import { requireCurrentUser } from "@/lib/session";
import { notificationsForUser } from "@/lib/notifications";

export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  const user = await requireCurrentUser();
  const notifications = await notificationsForUser(user.organizationId, user.id);

  return (
    <AppShell currentUser={{ name: user.name, email: user.email, accessRole: user.accessRole }} notifications={notifications}>
      {children}
    </AppShell>
  );
}
