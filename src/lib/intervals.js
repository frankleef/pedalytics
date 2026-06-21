// lib/intervals.js — intervals.icu API helpers, per-user credentials

const BASE_URL = "https://intervals.icu/api/v1";

export function intervalsAuth(apiKey) {
  if (!apiKey) throw new Error("Intervals.icu API-key ontbreekt");
  return "Basic " + Buffer.from("API_KEY:" + apiKey).toString("base64");
}

export async function intervalsGet(pad, params = {}, { apiKey, athleteId } = {}) {
  const key = apiKey;
  const athlete = athleteId;
  const url = new URL(`${BASE_URL}/athlete/${athlete}${pad}`);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) url.searchParams.set(k, v); });

  const resp = await fetch(url.toString(), {
    headers: { Authorization: intervalsAuth(key), "Content-Type": "application/json" },
    next: { revalidate: 0 },
  });

  if (!resp.ok) {
    const tekst = await resp.text();
    throw new Error(`Intervals API fout ${resp.status}: ${tekst}`);
  }
  return resp.json();
}

export async function intervalsPost(pad, body, { apiKey, athleteId } = {}) {
  const key = apiKey;
  const athlete = athleteId;
  const url = `${BASE_URL}/athlete/${athlete}${pad}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: intervalsAuth(key), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const tekst = await resp.text();
    throw new Error(`Intervals API fout ${resp.status}: ${tekst}`);
  }
  return resp.json();
}

export async function intervalsPut(pad, body, { apiKey, athleteId } = {}) {
  const key = apiKey;
  const athlete = athleteId;
  const url = `${BASE_URL}/athlete/${athlete}${pad}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: intervalsAuth(key), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const tekst = await resp.text();
    throw new Error(`Intervals API fout ${resp.status}: ${tekst}`);
  }
  return resp.json();
}

export async function intervalsDelete(pad, { apiKey, athleteId } = {}) {
  const key = apiKey;
  const athlete = athleteId;
  const url = `${BASE_URL}/athlete/${athlete}${pad}`;
  const resp = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: intervalsAuth(key) },
  });
  if (!resp.ok) {
    const tekst = await resp.text();
    throw new Error(`Intervals API fout ${resp.status}: ${tekst}`);
  }
  return resp.status === 204 ? null : resp.json();
}

export async function intervalsActivityGet(id, { apiKey } = {}) {
  const key = apiKey;
  const resp = await fetch(`${BASE_URL}/activity/${id}`, {
    headers: { Authorization: intervalsAuth(key) },
    next: { revalidate: 0 },
  });
  if (!resp.ok) {
    const tekst = await resp.text();
    throw new Error(`Intervals API fout ${resp.status}: ${tekst}`);
  }
  return resp.json();
}

export async function intervalsActivityPut(id, body, { apiKey } = {}) {
  const key = apiKey;
  const resp = await fetch(`${BASE_URL}/activity/${id}`, {
    method: "PUT",
    headers: { Authorization: intervalsAuth(key), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const tekst = await resp.text();
    throw new Error(`Intervals API fout ${resp.status}: ${tekst}`);
  }
  return resp.json();
}
