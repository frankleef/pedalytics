"use client";
import { useState } from "react";

export default function DagelijkseInvoer({ onOpslaan, laastOpgeslagen }) {
  const [hrv, setHrv] = useState(laastOpgeslagen?.hrv || "");
  const [rusthartslag, setRusthartslag] = useState(laastOpgeslagen?.rusthartslag || "");
  const [slaapScore, setSlaapScore] = useState(laastOpgeslagen?.slaapScore || "");
  const [slaapUren, setSlaapUren] = useState(laastOpgeslagen?.slaapUren || "");
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [laadt, setLaadt] = useState(false);

  const vandaag = new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  const datumIso = new Date().toISOString().split("T")[0];

  const HRV_BASISLIJN = 58;
  const HR_BASISLIJN = 49;

  const hrv_delta = hrv ? Number(hrv) - HRV_BASISLIJN : null;
  const hr_delta = rusthartslag ? Number(rusthartslag) - HR_BASISLIJN : null;

  const slaOp = async () => {
    if (!hrv && !rusthartslag) return;
    setLaadt(true);
    try {
      const resp = await fetch("/api/intervals/wellness", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datum: datumIso,
          hrv: hrv ? Number(hrv) : undefined,
          rusthartslag: rusthartslag ? Number(rusthartslag) : undefined,
          slaapScore: slaapScore ? Number(slaapScore) : undefined,
          slaapUren: slaapUren ? Number(slaapUren) : undefined,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setOpgeslagen(true);
        onOpslaan?.({ hrv: Number(hrv), rusthartslag: Number(rusthartslag), slaapScore: Number(slaapScore), datum: datumIso });
        setTimeout(() => setOpgeslagen(false), 3000);
      }
    } catch (e) {
      console.error("Opslaan mislukt:", e);
    }
    setLaadt(false);
  };

  return (
    <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
        Ochtendmeting
      </div>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14 }}>{vandaag}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {/* HRV */}
        <div style={{ background: "#07111d", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700, marginBottom: 6 }}>HRV (ms)</div>
          <input type="number" value={hrv} onChange={e => setHrv(e.target.value)}
            placeholder="bijv. 58"
            style={{ width: "100%", background: "transparent", border: "none", outline: "none",
              fontSize: 28, fontWeight: 900, color: "#a78bfa", boxSizing: "border-box" }} />
          {hrv_delta !== null && (
            <div style={{ fontSize: 11, marginTop: 4, fontWeight: 700,
              color: hrv_delta >= 0 ? "#4ade80" : hrv_delta >= -5 ? "#fbbf24" : "#ef4444" }}>
              {hrv_delta > 0 ? "+" : ""}{hrv_delta} vs basislijn
            </div>
          )}
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>basislijn {HRV_BASISLIJN} ms</div>
        </div>

        {/* Rusthartslag */}
        <div style={{ background: "#07111d", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, marginBottom: 6 }}>Rusthartslag (bpm)</div>
          <input type="number" value={rusthartslag} onChange={e => setRusthartslag(e.target.value)}
            placeholder="bijv. 49"
            style={{ width: "100%", background: "transparent", border: "none", outline: "none",
              fontSize: 28, fontWeight: 900, color: "#4ade80", boxSizing: "border-box" }} />
          {hr_delta !== null && (
            <div style={{ fontSize: 11, marginTop: 4, fontWeight: 700,
              color: hr_delta <= 1 ? "#4ade80" : hr_delta <= 4 ? "#fbbf24" : "#ef4444" }}>
              {hr_delta > 0 ? "+" : ""}{hr_delta} vs basislijn
            </div>
          )}
          <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>basislijn {HR_BASISLIJN} bpm</div>
        </div>

        {/* Slaapuren */}
        <div style={{ background: "#07111d", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, marginBottom: 6 }}>Slaap (uren)</div>
          <input type="number" step="0.5" value={slaapUren} onChange={e => setSlaapUren(e.target.value)}
            placeholder="bijv. 7.5"
            style={{ width: "100%", background: "transparent", border: "none", outline: "none",
              fontSize: 28, fontWeight: 900, color: "#60a5fa", boxSizing: "border-box" }} />
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>doel: 7-8 uur</div>
        </div>

        {/* Slaapscore */}
        <div style={{ background: "#07111d", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 700, marginBottom: 6 }}>Slaapscore (0-100)</div>
          <input type="number" min="0" max="100" value={slaapScore} onChange={e => setSlaapScore(e.target.value)}
            placeholder="bijv. 78"
            style={{ width: "100%", background: "transparent", border: "none", outline: "none",
              fontSize: 28, fontWeight: 900, color: "#818cf8", boxSizing: "border-box" }} />
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>van Garmin app</div>
        </div>
      </div>

      {/* Visuele terugkoppeling */}
      {(hrv || rusthartslag) && (
        <div style={{ background: "#07111d", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, fontWeight: 600 }}>Wat dit zegt:</div>
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
            {hrv && hrv_delta !== null && (
              <div>{hrv_delta >= 2 ? "✅ HRV boven basislijn — goed herstel" : hrv_delta >= -3 ? "⚡ HRV rond basislijn — normaal herstel" : "⚠️ HRV onder basislijn — extra rust overwegen"}</div>
            )}
            {rusthartslag && hr_delta !== null && (
              <div>{hr_delta <= 2 ? "✅ Rusthartslag normaal" : hr_delta <= 5 ? "⚡ Rusthartslag licht verhoogd — matige training" : "⚠️ Rusthartslag sterk verhoogd — rust vandaag"}</div>
            )}
            {slaapUren && (
              <div>{Number(slaapUren) >= 7.5 ? "✅ Voldoende slaap" : Number(slaapUren) >= 6.5 ? "⚡ Matige slaap — intensiteit aanpassen" : "⚠️ Weinig slaap — lichte training of rust"}</div>
            )}
          </div>
        </div>
      )}

      <button onClick={slaOp} disabled={laadt || (!hrv && !rusthartslag)}
        style={{ width: "100%", padding: 14,
          background: opgeslagen ? "#166534" : (!hrv && !rusthartslag) ? "#1e293b" : "linear-gradient(135deg,#1d4ed8,#2563eb)",
          border: "none", borderRadius: 10,
          color: (!hrv && !rusthartslag) ? "#475569" : "white",
          fontSize: 14, fontWeight: 700, cursor: (!hrv && !rusthartslag) ? "not-allowed" : "pointer" }}>
        {opgeslagen ? "✓ Opgeslagen in intervals.icu!" : laadt ? "⏳ Opslaan..." : "Ochtendmeting opslaan"}
      </button>

      <div style={{ fontSize: 11, color: "#475569", textAlign: "center", marginTop: 8 }}>
        Wordt gebruikt voor herstelstatus en weekschema
      </div>

      {/* Garmin data als beschikbaar */}
      {(laastOpgeslagen?.bodyBattery || laastOpgeslagen?.stressLevel || laastOpgeslagen?.stappen) && (
        <div style={{ marginTop: 12, borderTop: "1px solid #1e293b", paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
            Garmin data vandaag
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {laastOpgeslagen.bodyBattery && (
              <div style={{ background: "#07111d", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: laastOpgeslagen.bodyBattery > 70 ? "#4ade80" : laastOpgeslagen.bodyBattery > 40 ? "#fbbf24" : "#ef4444" }}>
                  {laastOpgeslagen.bodyBattery}
                </div>
                <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Body Battery</div>
              </div>
            )}
            {laastOpgeslagen.stressLevel && (
              <div style={{ background: "#07111d", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: laastOpgeslagen.stressLevel < 30 ? "#4ade80" : laastOpgeslagen.stressLevel < 60 ? "#fbbf24" : "#ef4444" }}>
                  {laastOpgeslagen.stressLevel}
                </div>
                <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Stress</div>
              </div>
            )}
            {laastOpgeslagen.stappen && (
              <div style={{ background: "#07111d", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#60a5fa" }}>
                  {Math.round(laastOpgeslagen.stappen / 1000)}k
                </div>
                <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>Stappen</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
