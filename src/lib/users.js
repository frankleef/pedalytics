import { getKV } from "./kv";
import { encrypt, decrypt } from "./crypto";
import bcrypt from "bcryptjs";

export async function getUserByEmail(email) {
  const kv = getKV();
  const userId = await kv.get(`email:${email.toLowerCase()}`);
  if (!userId) return null;
  return await kv.get(`user:${userId}`);
}

export async function getUserById(id) {
  return await getKV().get(`user:${id}`);
}

export async function createUser({ email, password, naam }) {
  const kv = getKV();
  const emailLower = email.toLowerCase();
  const bestaand = await kv.get(`email:${emailLower}`);
  if (bestaand) throw new Error("E-mailadres al in gebruik");

  const id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const hash = await bcrypt.hash(password, 12);

  const user = { id, email: emailLower, passwordHash: hash, naam, createdAt: new Date().toISOString() };
  await kv.set(`user:${id}`, user);
  await kv.set(`email:${emailLower}`, id);
  return user;
}

export async function verifyPassword(user, password) {
  return await bcrypt.compare(password, user.passwordHash);
}

export async function setIntervalsKey(userId, apiKey, athleteId) {
  const kv = getKV();
  await kv.set(`user:${userId}:intervals_key`, encrypt(apiKey));
  await kv.set(`user:${userId}:athlete_id`, athleteId);
}

export async function getIntervalsCredentials(userId) {
  const kv = getKV();
  const encKey = await kv.get(`user:${userId}:intervals_key`);
  const athleteId = await kv.get(`user:${userId}:athlete_id`);
  if (!encKey) return null;
  return { apiKey: decrypt(encKey), athleteId };
}

export function kvKey(userId, key) {
  return `${userId}:${key}`;
}
