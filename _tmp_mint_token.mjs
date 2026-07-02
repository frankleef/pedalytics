import { encode } from "next-auth/jwt";
import { readFileSync } from "node:fs";

const envRaw = readFileSync("/home/frank/pedalytics/fietscoach_clean/.env.local", "utf8");
const env = Object.fromEntries(
  envRaw.split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"(.*)"$/, "$1")]; })
);

const token = await encode({
  token: { userId: "u_frank_001", hasIntervalsKey: true, sub: "u_frank_001" },
  secret: env.NEXTAUTH_SECRET,
});
console.log(token);
