export async function claudeCall({ prompt, system, max_tokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY niet geconfigureerd");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens, system, messages: [{ role: "user", content: prompt }] }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude API ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const cleaned = text.replace(/```json|```/g, "").trim();
  if (!cleaned) throw new Error("Lege response van Claude");
  if (data.stop_reason === "max_tokens") {
    console.error("[claudeCall] Response afgekapt. Laatste 200 chars:", cleaned.slice(-200));
    throw new Error("Claude response afgekapt — max_tokens te laag voor deze prompt");
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("[claudeCall] JSON parse mislukt. Eerste 300 chars:", cleaned.slice(0, 300));
    throw new Error(`JSON parse mislukt: ${e.message}`);
  }
}
