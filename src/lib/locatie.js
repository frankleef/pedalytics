import { getKV } from "./kv";

export async function haalGebruikersLocatie(userId) {
  const kv = getKV();
  const locatie = userId ? await kv.get(`${userId}:weer-locatie`).catch(() => null) : null;
  return {
    lat: locatie?.lat ?? 51.5873,
    lon: locatie?.lon ?? 4.7958,
    stad: locatie?.stad ?? "Breda",
  };
}
