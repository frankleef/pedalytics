export async function startJob(type, params) {
  const resp = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, params }),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || "Job starten mislukt");
  return data.jobId;
}

export function pollJob(jobId, { interval = 2500, timeout = 120000 } = {}) {
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
        reject(e);
      }
    };
    check();
  });
}
