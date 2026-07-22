import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "./authOptions";
import { getIntervalsCredentials } from "./users";

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

