import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/setup", "/api/health", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/icons") || pathname === "/manifest.json" || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionCookie = request.cookies.get("session");
  if (!sessionCookie?.value) {
    // Redirect to login (or setup if no user yet)
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // JWT verification happens server-side in API routes.
  // Middleware only checks cookie presence for the redirect flow.
  // This avoids importing jsonwebtoken (Node.js-only) in Edge Runtime.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
