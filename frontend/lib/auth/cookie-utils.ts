export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function parseCsvCookie(value?: string) {
  if (!value) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function toCsvCookie(values: Set<string>) {
  return Array.from(values).join(",");
}

export type StoredUser = { username: string; password: string; companyDomain: string };

export function parseUserStoreCookie(value?: string): StoredUser[] {
  if (!value) return [];
  try {
    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded) as StoredUser[];
    return Array.isArray(parsed)
      ? parsed.filter((row) => !!row.username && !!row.password)
      : [];
  } catch {
    return [];
  }
}

export function serializeUserStoreCookie(users: StoredUser[]) {
  return encodeURIComponent(JSON.stringify(users));
}

export function isCorporateDomain(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain || !domain.includes(".")) return false;
  const blocked = new Set([
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "aol.com",
    "icloud.com",
    "protonmail.com",
  ]);
  return !blocked.has(domain);
}
