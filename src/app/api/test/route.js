import { NextResponse } from "next/server";

export async function GET() {
  const API_KEY = process.env.INTERVALS_API_KEY;
  const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID || "i594622";
  
  const keyInfo = API_KEY 
    ? `Key aanwezig: ${API_KEY.slice(0,4)}...${API_KEY.slice(-4)} (${API_KEY.length} tekens)`
    : "GEEN KEY GEVONDEN";

  try {
    const auth = "Basic " + Buffer.from("API_KEY:" + API_KEY).toString("base64");
    const url = `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/profile`;
    const resp = await fetch(url, { headers: { Authorization: auth } });
    const body = await resp.text();
    
    return NextResponse.json({
      keyInfo,
      athleteId: ATHLETE_ID,
      httpStatus: resp.status,
      body: body.slice(0, 300),
    });
  } catch (error) {
    return NextResponse.json({ keyInfo, error: error.message });
  }
}
