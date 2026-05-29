import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeUsername, parseCsvCookie } from "@/lib/auth/cookie-utils";

export async function GET() {
  const cookieStore = await cookies();
  const authed = cookieStore.get("tam_auth")?.value === "1";
  const user = normalizeUsername(cookieStore.get("tam_user")?.value ?? "");
  const onboarded = parseCsvCookie(cookieStore.get("tam_onboarded_users")?.value);
  const firstLogin = user ? !onboarded.has(user) : false;
  return NextResponse.json({ authenticated: authed, user, firstLogin });
}
