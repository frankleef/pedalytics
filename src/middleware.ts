import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { Redis } from "@upstash/redis";
// Redis wordt alleen gebruikt als het JWT-token nog geen hasIntervalsKey/onboardingSkipped flag heeft (eerste login na koppeling)

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/register"];
const ONBOARDING_PATHS = ["/onboarding", "/api/onboarding", "/privacybeleid"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

function isOnboarding(pathname: string) {
  return ONBOARDING_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname) || pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname.startsWith("/.well-known/") || pathname.startsWith("/api/cron/") || /\.(ico|png|svg|jpg|webp|css|js|woff2?|json)$/.test(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isOnboarding(pathname)) return NextResponse.next();

  const userId = token.userId as string;
  const hasSetup = token.hasIntervalsKey || token.onboardingSkipped;
  if (userId && !hasSetup) {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
    const hasKey = await redis.get(`user:${userId}:intervals_key`);
    const overgeslagen = await redis.get(`user:${userId}:onboarding_overgeslagen`);
    if (!hasKey && !overgeslagen) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding/intervals";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
