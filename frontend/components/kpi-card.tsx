"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Metric } from "@/lib/schemas/types";
import { MetricTraceModal } from "@/components/modals/metric-trace-modal";
import { SeverityBadge } from "@/components/severity-badge";
import { useGlobalStore } from "@/lib/store/use-global-store";

function fmtBenchmarkValue(value: number, unit: NonNullable<Metric["benchmark"]>["unit"]) {
  if (unit === "currency_m") return `$${value.toFixed(1)}M`;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "ratio") return `${value.toFixed(1)}`;
  return `${Math.round(value)}`;
}

export function KpiCard({ metric, benchmarkMode = false }: { metric: Metric; benchmarkMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const { setSelectedMetricId } = useGlobalStore();
  const benchmark = metric.benchmark;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setSelectedMetricId(next ? metric.id : null);
  };

  const benchmarkMin = benchmark
    ? Math.min(benchmark.lowerQuartile, benchmark.companyValue, benchmark.sectorMedian, benchmark.subSectorMedian)
    : 0;
  const benchmarkMax = benchmark
    ? Math.max(benchmark.upperQuartile, benchmark.companyValue, benchmark.sectorMedian, benchmark.subSectorMedian)
    : 1;
  const span = Math.max(benchmarkMax - benchmarkMin, 0.01);
  const pos = (value: number) => `${Math.max(0, Math.min(100, ((value - benchmarkMin) / span) * 100)).toFixed(1)}%`;

  return (
    <>
      <Card className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-soft" onClick={() => handleOpenChange(true)}>
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-2xl font-bold">{metric.value}</p>
            {metric.severity ? <SeverityBadge severity={metric.severity} /> : null}
          </div>
          {metric.delta ? <p className="mt-2 text-xs text-muted-foreground">vs last run: {metric.delta}</p> : null}
          {benchmark && benchmarkMode ? (
            <div className="mt-3 rounded-md border bg-muted/30 p-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>{benchmark.sector} / {benchmark.subSector}</span>
                <span>Benchmark Band</span>
              </div>
              <div className="relative mt-2 h-2 rounded-full bg-muted">
                <div
                  className="absolute top-0 h-2 rounded-full bg-sky-200/80"
                  style={{ left: pos(benchmark.lowerQuartile), width: `calc(${pos(benchmark.upperQuartile)} - ${pos(benchmark.lowerQuartile)})` }}
                />
                <span className="absolute -top-1 h-4 w-0.5 bg-slate-500" style={{ left: pos(benchmark.sectorMedian) }} />
                <span className="absolute -top-1 h-4 w-0.5 bg-cyan-600" style={{ left: pos(benchmark.subSectorMedian) }} />
                <span className="absolute -top-1 h-4 w-1 rounded bg-rose-600" style={{ left: pos(benchmark.companyValue) }} />
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Company {fmtBenchmarkValue(benchmark.companyValue, benchmark.unit)} | Sector {fmtBenchmarkValue(benchmark.sectorMedian, benchmark.unit)} | Sub-sector {fmtBenchmarkValue(benchmark.subSectorMedian, benchmark.unit)}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <MetricTraceModal open={open} onOpenChange={handleOpenChange} metric={metric} />
    </>
  );
}
