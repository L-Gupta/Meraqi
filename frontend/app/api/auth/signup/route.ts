import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import {
  isCorporateDomain,
  normalizeUsername,
  parseUserStoreCookie,
  serializeUserStoreCookie,
} from "@/lib/auth/cookie-utils";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  companyDomain: z.string().min(3),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid signup payload" }, { status: 400 });
  }

  const email = normalizeUsername(parsed.data.email);
  const companyDomain = parsed.data.companyDomain.trim().toLowerCase().replace(/^@/, "");
  const emailDomain = email.split("@")[1] ?? "";

  if (!isCorporateDomain(email)) {
    return NextResponse.json({ ok: false, message: "Use your company email domain to sign up." }, { status: 400 });
  }

  if (emailDomain !== companyDomain) {
    return NextResponse.json({ ok: false, message: "Email domain must match your company domain." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const users = parseUserStoreCookie(cookieStore.get("tam_user_store")?.value);
  const exists = users.some((u) => normalizeUsername(u.username) === email);
  if (exists) {
    return NextResponse.json({ ok: false, message: "Account already exists. Please sign in." }, { status: 409 });
  }

  const updatedUsers = [...users, { username: email, password: parsed.data.password, companyDomain }];

  const response = NextResponse.json({ ok: true, user: { name: parsed.data.fullName, username: email }, firstLogin: true });
  response.cookies.set("tam_user_store", serializeUserStoreCookie(updatedUsers), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  response.cookies.set("tam_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  response.cookies.set("tam_user", email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
