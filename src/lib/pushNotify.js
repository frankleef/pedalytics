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
  if (!subscription?.endpoint) return false;

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      await kv.del(`push-sub:${userId}`);
    }
    return false;
  }
}
