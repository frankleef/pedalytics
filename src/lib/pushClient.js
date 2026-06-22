async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  let reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) {
    reg = await navigator.serviceWorker.register("/sw.js");
  }
  await navigator.serviceWorker.ready;
  return reg;
}

export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) { console.error("VAPID public key ontbreekt"); return false; }

  const reg = await getRegistration();
  if (!reg) return false;

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  const resp = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  const data = await resp.json();
  if (!data.success) { console.error("Push subscribe mislukt:", data.error); return false; }

  return true;
}

export async function unsubscribeFromPush() {
  const reg = await getRegistration();
  if (!reg) return;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  await fetch("/api/push/subscribe", { method: "DELETE" });
}

export async function isPushSubscribed() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg || !reg.active) return false;
  const subscription = await reg.pushManager.getSubscription();
  return !!subscription;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
