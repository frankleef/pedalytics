import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

const PUBLIC_PATHS = ["/login", "/api/login", "/api/logout-all", "/api/test"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname) || pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || /\.(ico|png|svg|jpg|webp|css|js|woff2?)$/.test(pathname)) {
    return NextResponse.next();
  }

  const sessionId = request.cookies.get("session_id")?.value;

  if (sessionId) {
    try {
      const redis = new Redis({
        url: process.env.KV_REST_API_URL!,
        token: process.env.KV_REST_API_TOKEN!,
      });
      const valid = await redis.get(`session:${sessionId}`);
      if (valid) return NextResponse.next();
    } catch {}
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
