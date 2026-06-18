// lib/intervals.js — gedeelde helper voor intervals.icu API calls

const BASE_URL = "https://intervals.icu/api/v1";
const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID || "i594622";
const API_KEY = process.env.INTERVALS_API_KEY;

export function intervalsAuth() {
  if (!API_KEY) throw new Error("INTERVALS_API_KEY niet geconfigureerd in environment variables");
  return "Basic " + Buffer.from("API_KEY:" + API_KEY).toString("base64");
}

export async function intervalsGet(pad, params = {}) {
  const url = new URL(`${BASE_URL}/athlete/${ATHLETE_ID}${pad}`);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) url.searchParams.set(k, v); });

  const resp = await fetch(url.toString(), {
    headers: { Authorization: intervalsAuth(), "Content-Type": "application/json" },
    next: { revalidate: 0 },
  });

  if (!resp.ok) {
    const tekst = await resp.text();
    throw new Error(`Intervals API fout ${resp.status}: ${tekst}`);
  }
  return resp.json();
}

export async function intervalsPost(pad, body) {
  const url = `${BASE_URL}/athlete/${ATHLETE_ID}${pad}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: intervalsAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const tekst = await resp.text();
    throw new Error(`Intervals API fout ${resp.status}: ${tekst}`);
  }
  return resp.json();
}

export async function intervalsPut(pad, body) {
  const url = `${BASE_URL}/athlete/${ATHLETE_ID}${pad}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: intervalsAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const tekst = await resp.text();
    throw new Error(`Intervals API fout ${resp.status}: ${tekst}`);
  }
  return resp.json();
}

export { ATHLETE_ID };
