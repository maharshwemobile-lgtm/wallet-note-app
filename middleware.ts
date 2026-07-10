import { NextRequest, NextResponse } from "next/server";
export function middleware(req: NextRequest) {
  const token = req.cookies.get("wallet_note_session")?.value;
  const protectedPath = ["/dashboard", "/wallet", "/exchange", "/lottery", "/settings", "/connect-sheet", "/admin"].some(p => req.nextUrl.pathname.startsWith(p));
  if (protectedPath && !token) return NextResponse.redirect(new URL("/login", req.url));
  if (["/login", "/register"].includes(req.nextUrl.pathname) && token) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard/:path*", "/wallet/:path*", "/exchange/:path*", "/lottery/:path*", "/settings/:path*", "/connect-sheet/:path*", "/admin/:path*", "/login", "/register"] };
