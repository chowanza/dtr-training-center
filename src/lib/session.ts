import { cookies } from "next/headers";
import { getDb } from "./db";

const COOKIE = "dtr_user";

export async function getCurrentUser() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value ?? "u-owen";
  const db = getDb();
  return db.users.find((u) => u.id === id) ?? db.users[0];
}

export async function setCurrentUserCookie(userId: string) {
  const store = await cookies();
  store.set(COOKIE, userId, { path: "/", maxAge: 60 * 60 * 24 * 30 });
}
