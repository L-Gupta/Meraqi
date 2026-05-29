"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const floatingOrbs = [
  { left: "10%", top: "14%", delay: "0s", duration: "7s", size: "h-28 w-28" },
  { left: "74%", top: "8%", delay: "1.2s", duration: "8s", size: "h-36 w-36" },
  { left: "82%", top: "62%", delay: "0.4s", duration: "9s", size: "h-20 w-20" },
  { left: "14%", top: "72%", delay: "1.7s", duration: "10s", size: "h-24 w-24" },
];

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 tam-grid" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(56,189,248,0.22),transparent_40%),radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.22),transparent_45%)]" />

      {floatingOrbs.map((orb, idx) => (
        <div
          key={idx}
          className={`absolute ${orb.size} rounded-full bg-cyan-300/20 blur-2xl tam-float`}
          style={{ left: orb.left, top: orb.top, animationDelay: orb.delay, animationDuration: orb.duration }}
        />
      ))}

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-20">
        <div className="tam-fade-up max-w-3xl rounded-2xl border border-white/20 bg-white/10 p-10 backdrop-blur-xl">
          <p className="mb-4 inline-flex rounded-full border border-cyan-200/40 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
            TAM Financial Due Diligence Automation
          </p>
          <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
            Welcome to the next generation deal analysis cockpit.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 md:text-lg">
            Ingest documents, trigger automated financial due diligence analysis, and walk into investor-grade insights across QoE,
            working capital, cash conversion, tie-outs, and risk.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="h-11 px-6 text-sm" onClick={() => router.push("/signup")}>
              Sign Up (Company Domain)
            </Button>
            <Button variant="outline" className="h-11 border-white/35 bg-transparent px-6 text-sm text-white hover:bg-white/10" onClick={() => router.push("/login")}>Existing Analyst Sign In</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
