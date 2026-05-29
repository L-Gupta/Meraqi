"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, companyDomain, password }),
      });

      const json = (await res.json()) as { ok?: boolean; message?: string; firstLogin?: boolean };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Unable to create account");
        return;
      }

      router.push(json.firstLogin ? "/onboarding" : "/dashboard");
      router.refresh();
    } catch {
      setError("Unable to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-6 py-14 text-slate-100">
      <div className="absolute inset-0 tam-grid opacity-40" />
      <div className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative mx-auto max-w-lg">
        <Card className="border-white/20 bg-white/10 text-white backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Create Analyst Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <label className="block text-sm">
                Full Name
                <input
                  className="mt-1 w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 outline-none focus:border-emerald-300"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Analyst"
                />
              </label>
              <label className="block text-sm">
                Company Email
                <input
                  className="mt-1 w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 outline-none focus:border-emerald-300"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@acmecorp.com"
                />
              </label>
              <label className="block text-sm">
                Company Domain
                <input
                  className="mt-1 w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 outline-none focus:border-emerald-300"
                  value={companyDomain}
                  onChange={(e) => setCompanyDomain(e.target.value)}
                  placeholder="acmecorp.com"
                />
              </label>
              <label className="block text-sm">
                Password
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border border-white/25 bg-white/10 px-3 py-2 outline-none focus:border-emerald-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </label>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account..." : "Sign up with company domain"}</Button>
            </form>
            <p className="mt-4 text-xs text-slate-300">
              Already registered? <button type="button" className="underline" onClick={() => router.push("/login")}>Sign in</button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
