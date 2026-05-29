import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { normalizeUsername, parseCsvCookie, parseUserStoreCookie } from "@/lib/auth/cookie-utils";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const DEMO_USERNAME = "analyst@tam.com";
const DEMO_PASSWORD = "TAM2026!";

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  const username = normalizeUsername(parsed.data.username);
  const { password } = parsed.data;

  const cookieStore = await cookies();
  const storedUsers = parseUserStoreCookie(cookieStore.get("tam_user_store")?.value);
  const matchedStoredUser = storedUsers.find((user) => normalizeUsername(user.username) === username && user.password === password);
  const isDemoUser = username === DEMO_USERNAME && password === DEMO_PASSWORD;

  if (!matchedStoredUser && !isDemoUser) {
    return NextResponse.json({ ok: false, message: "Invalid username or password" }, { status: 401 });
  }

  const onboardedUsers = parseCsvCookie(cookieStore.get("tam_onboarded_users")?.value);
  const firstLogin = !onboardedUsers.has(username);

  const response = NextResponse.json({ ok: true, user: { name: "TAM Analyst", username }, firstLogin });
  response.cookies.set("tam_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  response.cookies.set("tam_user", username, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
