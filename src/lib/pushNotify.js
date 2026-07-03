import webpush from "web-push";
import { getKV } from "./kv";

webpush.setVapidDetails(
  "mailto:fr.levering@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function sendPush(userId, payload) {
  const kv = getKV();
  const subscription = await kv.get(`push-sub:${userId}`);
  if (!subscription?.endpoint) {
    console.warn(`[push] geen subscriptie voor ${userId}, niet verstuurd: "${payload.title}"`);
    return false;
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log(`[push] verstuurd naar ${userId}: "${payload.title}"`);
    return true;
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      console.warn(`[push] subscriptie verlopen voor ${userId} (${e.statusCode}), verwijderd uit KV`);
      await kv.del(`push-sub:${userId}`);
    } else {
      console.error(`[push] versturen mislukt voor ${userId} (status ${e.statusCode ?? "?"}):`, e.message);
    }
    return false;
  }
}
