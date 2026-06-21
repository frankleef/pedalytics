import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
import { getIntervalsCredentials, kvKey } from "./users";
import { getKV } from "./kv";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export class NietGekoppeldError extends Error {
  constructor() { super("Intervals.icu niet gekoppeld"); this.code = "NOT_LINKED"; }
}

export async function getUserIntervalsConfig() {
  const user = await getSessionUser();
  if (!user) throw new Error("Niet ingelogd");
  const creds = await getIntervalsCredentials(user.id);
  if (!creds) throw new NietGekoppeldError();
  return { userId: user.id, ...creds };
}

export async function userKV(key) {
  const user = await getSessionUser();
  if (!user) throw new Error("Niet ingelogd");
  return { kv: getKV(), key: kvKey(user.id, key), userId: user.id };
}
