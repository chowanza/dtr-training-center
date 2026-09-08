import "server-only";
import { and, eq, desc } from "drizzle-orm";
import { db, withTenantContext } from "./drizzle/client";
import { notifications } from "./drizzle/schema";

type Tx = typeof db;

/** Insert a notification from inside an existing transaction (e.g. publishModule's). */
export async function createNotificationTx(
  tx: Tx,
  params: { organizationId: string; userId: string; type: string; title: string; body?: string; linkHref?: string }
) {
  await tx.insert(notifications).values({
    organizationId: params.organizationId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? "",
    linkHref: params.linkHref,
  });
}

const RECENT_LIMIT = 20;

/** Most recent notifications for this person — unread first, capped so the bell dropdown stays short. */
export async function notificationsForUser(orgId: string, userId: string) {
  return withTenantContext(orgId, (tx) =>
    tx
      .select()
      .from(notifications)
      .where(and(eq(notifications.organizationId, orgId), eq(notifications.userId, userId)))
      .orderBy(desc(notifications.createdAt))
      .limit(RECENT_LIMIT)
  );
}
