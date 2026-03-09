/**
 * Edge middleware for route protection.
 * Checks for a JWT token in the Authorization header or draftly_token cookie.
 * Protected routes redirect to /login if no token is present.
 * /demo is always public (competition screen).
 */
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/moat-meter", "/roi-email", "/proposals"];
const AUTH_PREFIXES = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read JWT from cookie (set on login)
  const token = request.cookies.get("draftly_token")?.value;

  const isProtected = PROTECTED_PREFIXES.some((r) => pathname.startsWith(r));
  const isAuth = AUTH_PREFIXES.some((r) => pathname.startsWith(r));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuth && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|demo).*)"],
};
