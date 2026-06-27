"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from "recharts";
import { weeknummerVoorDatum } from "@/lib/weekgrenzen";

function berekenFtpPrognose(seizoensplan) {
  if (!seizoensplan?.kader) return [];
  const ftp = seizoensplan.huidige_ftp || 265;
  const ctl = seizoensplan.huidige_ctl || 45;
  const weken = seizoensplan.tijdshorizon_weken || 12;
  const ctlDoel = ctl + weken * 1.8;
  const ctlPerWeek = (ctlDoel - ctl) / weken;

  const factoren = { basis: 0.15, sweetspot: 0.18, drempel: 0.22, consolidatie: 0.15, test: 0, herstel: 0.05 };

  let cumulatief = 0;
  return seizoensplan.kader.map(w => {
    const factor = factoren[w.fase] || 0.15;
    cumulatief += ctlPerWeek * factor;
    const realistisch = Math.round(ftp + cumulatief);
    return {
      week: w.week,
      fase: w.fase,
      realistisch,
      conservatief: realistisch - 5,
      optimistisch: realistisch + 10,
      isFtpTest: w.week % 4 === 0,
    };
  });
}

function berekenCtlPad(seizoensplan) {
  if (!seizoensplan?.kader) return [];
  const ctl = seizoensplan.huidige_ctl || 45;
  const weken = seizoensplan.tijdshorizon_weken || 12;
  const ctlPerWeek = ((ctl + weken * 1.8) - ctl) / weken;

  return seizoensplan.kader.map(w => ({
    week: w.week,
    verwacht: Math.round(ctl + w.week * ctlPerWeek),
  }));
}

export default function SeizoenProgressiePanel({ seizoensplan, wellness, ritten }) {
  if (!seizoensplan?.kader) return null;

  const huidigeWeek = weeknummerVoorDatum(new Date(), seizoensplan.startdatum);
  const wekenTotDeadline = seizoensplan.tijdshorizon_weken - huidigeWeek;

  // FTP prognose
  const ftpData = berekenFtpPrognose(seizoensplan);

  // CTL pad: verwacht vs werkelijk
  const ctlVerwacht = berekenCtlPad(seizoensplan);
  const ctlData = ctlVerwacht.map(w => {
    const weekStart = new Date(startDatum.getTime() + (w.week - 1) * 7 * 86400000);
    const weekEind = new Date(weekStart.getTime() + 7 * 86400000);
    const wellnessWeek = (wellness || []).filter(d => {
      const datum = new Date(d.id || d.datum);
      return datum >= weekStart && datum < weekEind;
    });
    const werkelijkCtl = wellnessWeek.length > 0 ? Math.round(wellnessWeek[wellnessWeek.length - 1].ctl || 0) : null;
    return { ...w, werkelijk: w.week <= huidigeWeek ? werkelijkCtl : null };
  });

  // Weekvergelijkingstabel
  const weekData = seizoensplan.kader.slice(0, Math.min(huidigeWeek, seizoensplan.kader.length)).map(w => {
    const weekStart = new Date(startDatum.getTime() + (w.week - 1) * 7 * 86400000);
    const weekEind = new Date(weekStart.getTime() + 7 * 86400000);
    const weekRitten = (ritten || []).filter(r => {
      const d = new Date(r.datum_iso);
      return d >= weekStart && d < weekEind;
    });
    const werkelijkTss = Math.round(weekRitten.reduce((s, r) => s + (r.tss || 0), 0));
    const rpeRitten = weekRitten.filter(r => r.rpe);
    const gemRpe = rpeRitten.length > 0 ? Math.ceil(rpeRitten.reduce((s, r) => s + r.rpe, 0) / rpeRitten.length) : null;
    const ratio = w.tss_doel > 0 ? werkelijkTss / w.tss_doel : null;
    const status = ratio === null ? "—" : ratio >= 0.9 ? "✓" : ratio >= 0.7 ? "⚠️" : "✗";
    return { week: w.week, fase: w.fase, gepland: w.tss_doel, werkelijk: werkelijkTss, rpe: gemRpe, status, ratio };
  });

  const tooltipStyle = { background: "#0e1521", border: "1px solid #1e293b", borderRadius: 8, fontSize: 11 };
  const faseKleuren = { basis: "#60a5fa", sweetspot: "#fbbf24", drempel: "#f97316", consolidatie: "#4ade80", test: "#a78bfa", herstel: "#94a3b8" };

  return (
    <div>
      {/* Countdown */}
      {wekenTotDeadline > 0 && (
        <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Seizoensplan</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>Week {huidigeWeek} van {seizoensplan.tijdshorizon_weken}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Fase: <span style={{ color: faseKleuren[seizoensplan.kader[huidigeWeek - 1]?.fase] || "#94a3b8", fontWeight: 700 }}>
                {seizoensplan.kader[huidigeWeek - 1]?.fase}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#60a5fa", letterSpacing: -2 }}>{wekenTotDeadline}</div>
            <div style={{ fontSize: 9, color: "#64748b" }}>weken te gaan</div>
          </div>
        </div>
      )}

      {/* FTP prognose grafiek */}
      {seizoensplan.doel === "ftp_verhogen" && ftpData.length > 0 && (
        <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>FTP prognose</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
            {seizoensplan.huidige_ftp}W → {ftpData[ftpData.length - 1]?.realistisch}W (realistisch)
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={ftpData} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 9 }}
                tickFormatter={w => `W${w}`} />
              <YAxis domain={["dataMin - 10", "dataMax + 5"]} axisLine={false} tickLine={false}
                tick={{ fill: "#475569", fontSize: 9 }} width={40} tickCount={4} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => {
                const labels = { realistisch: "Realistisch", conservatief: "Conservatief", optimistisch: "Optimistisch" };
                return [`${v}W`, labels[name] || name];
              }} labelFormatter={w => `Week ${w}`} />
              <ReferenceLine x={huidigeWeek} stroke="#3b82f680" strokeDasharray="4 3" label={{ value: "Nu", fill: "#3b82f6", fontSize: 9, position: "top" }} />
              <Line type="monotone" dataKey="conservatief" stroke="#47556980" strokeWidth={1} strokeDasharray="4 3" dot={false} />
              <Line type="monotone" dataKey="realistisch" stroke="#60a5fa" strokeWidth={2} dot={(props) => {
                if (props.payload.isFtpTest) {
                  return <svg x={props.cx - 5} y={props.cy - 5} width={10} height={10}><polygon points="5,0 10,5 5,10 0,5" fill="#a78bfa" /></svg>;
                }
                return null;
              }} />
              <Line type="monotone" dataKey="optimistisch" stroke="#4ade8060" strokeWidth={1} strokeDasharray="4 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
            {[["Realistisch", "#60a5fa", "—"], ["Conservatief", "#475569", "- -"], ["Optimistisch", "#4ade80", "- -"], ["FTP-test", "#a78bfa", "◆"]].map(([l, k, s], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {s === "◆" ? <span style={{ color: k, fontSize: 10 }}>◆</span> : <div style={{ width: 14, height: 2, background: k, borderRadius: 1, borderTop: s === "- -" ? "1px dashed" : "none" }} />}
                <span style={{ fontSize: 9, color: "#64748b" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTL pad grafiek */}
      {ctlData.length > 0 && (
        <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>CTL progressie</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>Verwacht vs werkelijk fitheidspad</div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={ctlData} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 9 }}
                tickFormatter={w => `W${w}`} />
              <YAxis domain={["dataMin - 5", "dataMax + 5"]} axisLine={false} tickLine={false}
                tick={{ fill: "#475569", fontSize: 9 }} width={40} tickCount={3} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={w => `Week ${w}`}
                formatter={(v, name) => [v, name === "verwacht" ? "Verwacht" : "Werkelijk"]} />
              <ReferenceLine x={huidigeWeek} stroke="#3b82f680" strokeDasharray="4 3" />
              <Line type="monotone" dataKey="verwacht" stroke="#60a5fa60" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              <Line type="monotone" dataKey="werkelijk" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3, fill: "#60a5fa" }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 14, height: 2, background: "#60a5fa" }} />
              <span style={{ fontSize: 9, color: "#64748b" }}>Werkelijk</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 14, height: 2, background: "#60a5fa60", borderTop: "1px dashed" }} />
              <span style={{ fontSize: 9, color: "#64748b" }}>Verwacht</span>
            </div>
          </div>
        </div>
      )}

      {/* Weekvergelijkingstabel */}
      {weekData.length > 0 && (
        <div style={{ background: "#0e1521", border: "1px solid #1e293b", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Weekvergelijking</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ color: "#64748b", borderBottom: "1px solid #1e293b" }}>
                  {["Wk", "Fase", "Gepland", "Werkelijk", "RPE", ""].map(h => (
                    <th key={h} style={{ padding: "4px 6px", textAlign: h === "Fase" ? "left" : "right", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekData.map((w, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #0e1521" }}>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: "#94a3b8", fontWeight: 700 }}>{w.week}</td>
                    <td style={{ padding: "5px 6px", color: faseKleuren[w.fase] || "#94a3b8", fontWeight: 600 }}>
                      {w.fase?.charAt(0).toUpperCase() + w.fase?.slice(1, 4)}
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: "#64748b" }}>{w.gepland}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: w.ratio >= 0.9 ? "#4ade80" : w.ratio >= 0.7 ? "#fbbf24" : "#ef4444", fontWeight: 700 }}>
                      {w.werkelijk}
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: w.rpe ? (w.rpe >= 8 ? "#ef4444" : w.rpe >= 6 ? "#fbbf24" : "#4ade80") : "#475569" }}>
                      {w.rpe || "—"}
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontSize: 13 }}>{w.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
