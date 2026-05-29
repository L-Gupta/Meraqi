"use client";

import { useEffect, useState } from "react";
import { TrendingUp, BarChart2, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getFinancialSummary, type FinancialSummary } from "@/lib/api/fdd-client";

const fmt = (v: string) =>
  `$${Math.abs(Number(v)).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function DealSummaryBanner({ dealId }: { dealId: string }) {
  const [data, setData] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getFinancialSummary(dealId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
    </div>
  );

  if (!data) return null;

  const periods = data.periods;
  const ltmPeriods = periods.slice(-12);
  const ltmRevenue = ltmPeriods.reduce((s, p) => s + Number(data.revenue[p] ?? 0), 0);
  const ltmEbitda  = ltmPeriods.reduce((s, p) => s + Number(data.ebitda[p] ?? 0), 0);
  const latestPeriod = periods[periods.length - 1];
  const latestMargin = data.ebitda_margin_pct[latestPeriod] ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
        <BarChart2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">LTM Revenue</p>
          <p className="mt-0.5 text-2xl font-bold">{fmt(String(ltmRevenue))}</p>
          <p className="text-xs text-muted-foreground">{ltmPeriods[0]} – {ltmPeriods[ltmPeriods.length - 1]}</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
        <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">LTM EBITDA (Reported)</p>
          <p className="mt-0.5 text-2xl font-bold">{fmt(String(ltmEbitda))}</p>
          <p className="text-xs text-muted-foreground">{periods.length} months of data</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
        <Percent className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">EBITDA Margin ({latestPeriod})</p>
          <p className="mt-0.5 text-2xl font-bold">{latestMargin.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Reported, pre-QoE</p>
        </div>
      </div>
    </div>
  );
}
