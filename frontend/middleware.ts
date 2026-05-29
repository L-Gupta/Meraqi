import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth stripped for POC — redirect root to dashboard directly
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
};
