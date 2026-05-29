import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeUsername, parseCsvCookie, toCsvCookie } from "@/lib/auth/cookie-utils";

export async function POST() {
  const cookieStore = await cookies();
  const user = normalizeUsername(cookieStore.get("tam_user")?.value ?? "");

  if (!user) {
    return NextResponse.json({ ok: false, message: "No active user session" }, { status: 401 });
  }

  const onboarded = parseCsvCookie(cookieStore.get("tam_onboarded_users")?.value);
  onboarded.add(user);

  const response = NextResponse.json({ ok: true });
  response.cookies.set("tam_onboarded_users", toCsvCookie(onboarded), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  return response;
}
