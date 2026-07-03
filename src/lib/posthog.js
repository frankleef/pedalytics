import { PostHog } from "posthog-node";
import { waitUntil } from "@vercel/functions";

let client = null;

function getClient() {
  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

async function verstuur(event, userId, payload) {
  // Zonder token (test-omgeving, lokale setup zonder .env.local) niets versturen —
  // voorkomt zinloze netwerkcalls die tests zouden vertragen of laten hangen.
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;

  try {
    await getClient().captureImmediate({
      distinctId: userId,
      event,
      properties: {
        ...payload,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Observability mag nooit de hoofdflow breken — alleen loggen naar console
    console.error(`[posthog] logEvent faalde voor "${event}":`, err);
  }
}

/**
 * Vuurt een event af naar PostHog. Nooit awaiten is veilig: verstuur() slikt
 * eigen fouten in, en waitUntil() garandeert dat de flush voltooit vóór
 * function-shutdown op Vercel (buiten Vercel — lokale dev — is het een no-op
 * wrapper en loopt de promise gewoon door zonder de request op te houden).
 */
export function logEvent(event, userId, payload = {}) {
  const promise = verstuur(event, userId, payload);
  waitUntil(promise);
  return promise;
}
