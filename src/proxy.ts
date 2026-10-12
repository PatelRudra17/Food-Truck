import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "eils_session";
const PUBLIC_PATHS = ["/login"];

/**
 * Fast, cookie-presence-only redirect for UX. This does NOT validate the session
 * against the database — that authoritative check happens in the (app) route
 * group's server layout via requireUser(), which every protected page inherits.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico";

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (!isPublic && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // /login itself decides whether an existing cookie is still a valid session
  // (see src/app/login/page.tsx); redirecting on cookie presence alone looped
  // forever for expired or revoked sessions.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
