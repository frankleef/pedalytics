export async function startJob(type, params) {
  const resp = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, params }),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || "Job starten mislukt");
  if (data.status === "failed") throw new Error(data.error || "Job mislukt");
  if (data.status === "done" && data.result) return { jobId: data.jobId, result: data.result };
  return { jobId: data.jobId, result: null };
}

export async function startJobRobuust(type, params) {
  const body = JSON.stringify({ type, params });
  try {
    const resp = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || "Job starten mislukt");
    if (data.status === "failed") throw new Error(data.error || "Job mislukt");
    if (data.status === "done" && data.result) return data.result;
    return await pollJob(data.jobId);
  } catch (e) {
    if (e.name === "AbortError" || e.name === "TypeError" || e.message?.includes("fetch")) {
      console.warn("[jobClient] Fetch afgebroken, wacht op resultaat via polling...");
      await new Promise(r => setTimeout(r, 3000));
      return await herstelJob(type, params);
    }
    throw e;
  }
}

async function herstelJob(type, params) {
  for (let poging = 0; poging < 6; poging++) {
    try {
      const resp = await fetch("/api/jobs/laatst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, datum: params.datum }),
      });
      const data = await resp.json();
      if (data.status === "done" && data.result) return data.result;
      if (data.status === "failed") throw new Error(data.error || "Job mislukt");
    } catch {}
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("Sessiegeneratie mislukt — probeer opnieuw");
}

export function pollJob(jobId, { interval = 3000, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = async () => {
      try {
        const resp = await fetch(`/api/jobs/${jobId}`);
        const data = await resp.json();
        if (data.status === "done") return resolve(data.result);
        if (data.status === "failed") return reject(new Error(data.error || "Job mislukt"));
        if (Date.now() - start > timeout) return reject(new Error("Job timeout"));
        setTimeout(check, interval);
      } catch (e) {
        if (Date.now() - start > timeout) return reject(e);
        setTimeout(check, interval);
      }
    };
    check();
  });
}
