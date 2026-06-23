import { Receiver } from "@upstash/qstash";

export async function verifyQStash(request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentSigningKey) return true;

  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  try {
    const body = await request.clone().text();
    const receiver = new Receiver({ currentSigningKey, nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY });
    await receiver.verify({ signature, body });
    return true;
  } catch {
    return false;
  }
}
