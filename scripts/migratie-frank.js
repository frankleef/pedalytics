// Eenmalig migratiescript: maakt Frank's account aan en migreert bestaande data.
// Draai met: node --env-file=.env.local scripts/migratie-frank.js

import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.error("ENCRYPTION_KEY moet minimaal 32 tekens zijn in .env.local");
  process.exit(1);
}

function encrypt(text) {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), "utf8");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

const EMAIL = "fr.levering@gmail.com";
const NAAM = "Frank";
const PASSWORD = process.env.APP_PASSWORD;
const INTERVALS_KEY = process.env.INTERVALS_API_KEY;
const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID || "i594622";
const USER_ID = "u_frank_001";

const SLEUTELS = [
  "seizoensplan",
  "ftp-historie",
  "weer-locatie",
  "strava_tokens",
];

async function run() {
  console.log("=== Migratie Frank ===\n");

  // 1. Maak user aan
  const bestaand = await kv.get(`user:${USER_ID}`);
  if (bestaand) {
    console.log("User bestaat al, skip aanmaken");
  } else {
    if (!PASSWORD) { console.error("APP_PASSWORD nodig voor initieel wachtwoord"); process.exit(1); }
    const hash = await bcrypt.hash(PASSWORD, 12);
    const user = { id: USER_ID, email: EMAIL, passwordHash: hash, naam: NAAM, createdAt: new Date().toISOString() };
    await kv.set(`user:${USER_ID}`, user);
    await kv.set(`email:${EMAIL}`, USER_ID);
    console.log("✓ User aangemaakt:", USER_ID);
  }

  // 2. Intervals.icu key versleutelen
  if (!INTERVALS_KEY) { console.error("INTERVALS_API_KEY nodig"); process.exit(1); }
  const encKey = encrypt(INTERVALS_KEY);
  await kv.set(`user:${USER_ID}:intervals_key`, encKey);
  await kv.set(`user:${USER_ID}:athlete_id`, ATHLETE_ID);
  console.log("✓ Intervals.icu key versleuteld opgeslagen");

  // 3. Migreer KV-sleutels
  for (const sleutel of SLEUTELS) {
    const data = await kv.get(sleutel);
    if (data) {
      await kv.set(`${USER_ID}:${sleutel}`, data);
      console.log(`✓ ${sleutel} → ${USER_ID}:${sleutel}`);
    } else {
      console.log(`- ${sleutel}: geen data, skip`);
    }
  }

  // 4. Checkin-sleutels (datum-gebonden)
  // Scan voor checkin:* keys
  let cursor = 0;
  let checkinCount = 0;
  do {
    const [nextCursor, keys] = await kv.scan(cursor, { match: "checkin:*", count: 100 });
    cursor = nextCursor;
    for (const key of keys) {
      if (key.startsWith(`${USER_ID}:`)) continue; // al gemigreerd
      const data = await kv.get(key);
      if (data) {
        await kv.set(`${USER_ID}:${key}`, data, { ex: 86400 * 2 });
        checkinCount++;
      }
    }
  } while (cursor !== 0);
  if (checkinCount > 0) console.log(`✓ ${checkinCount} checkin-sleutels gemigreerd`);

  console.log("\n=== Migratie voltooid ===");
  console.log("\nVolgende stappen:");
  console.log("1. Voeg NEXTAUTH_SECRET=<random 32+ chars> toe aan .env.local");
  console.log("2. Voeg ENCRYPTION_KEY=<exact dezelfde als hierboven> toe aan .env.local (als dat nog niet gedaan is)");
  console.log("3. Herstart de dev-server");
  console.log("4. Log in met:", EMAIL);
}

run().catch(e => { console.error("Migratie mislukt:", e); process.exit(1); });
