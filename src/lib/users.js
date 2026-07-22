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

export async function setIntervalsKey(userId, apiKey) {
  const auth = "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64");
  const resp = await fetch("https://intervals.icu/api/v1/athlete/0", { headers: { Authorization: auth } });
  if (!resp.ok) throw new Error(`Ongeldige API-key (intervals.icu ${resp.status})`);
  const athlete = await resp.json();
  if (!athlete.id) throw new Error("Kon athlete ID niet ophalen");

  const gekoppeldeApparaten = {
    garmin: !!athlete.icu_garmin_health,
    wahoo: !!athlete.wahoo_user_id,
    whoop: !!athlete.whoop_scope,
  };

  const kv = getKV();
  await kv.set(`user:${userId}:intervals_key`, encrypt(apiKey));
  await kv.set(`user:${userId}:athlete_id`, athlete.id);
  await kv.set(`user:${userId}:athlete_naam`, athlete.name || athlete.firstname || "");
  await kv.set(`user:${userId}:apparaten`, gekoppeldeApparaten);
  invalidateCredsCache(userId);

  // Voeg user toe aan actieve-users-lijst voor cron-sync
  const actief = (await kv.get("users:active")) || [];
  if (!actief.includes(userId)) {
    actief.push(userId);
    await kv.set("users:active", actief);
  }

  return { athleteId: athlete.id, naam: athlete.name, apparaten: gekoppeldeApparaten };
}

// In-memory cache voor credentials (24 uur TTL, per serverless instance)
const credsCache = new Map();
const CREDS_TTL = 24 * 60 * 60 * 1000;

export function invalidateCredsCache(userId) {
  credsCache.delete(userId);
}

export async function getIntervalsCredentials(userId, kv = getKV()) {
  const cached = credsCache.get(userId);
  if (cached && Date.now() - cached.ts < CREDS_TTL) return cached.data;

  const [encKey, athleteId] = await kv.mget(`user:${userId}:intervals_key`, `user:${userId}:athlete_id`);
  if (!encKey) return null;
  const data = { apiKey: decrypt(encKey), athleteId };
  credsCache.set(userId, { data, ts: Date.now() });
  return data;
}

export function kvKey(userId, key) {
  return `${userId}:${key}`;
}
