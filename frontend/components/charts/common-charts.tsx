"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Cell,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useThemeStore } from "@/lib/store/use-theme-store";

const numberFormat = (value: number) => `${value.toFixed(1)}`;

function useChartPalette() {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  return {
    isDark,
    grid: isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(100, 116, 139, 0.28)",
    axis: isDark ? "#d7f7ff" : "#0f172a",
    tick: isDark ? "#c9ebf7" : "#334155",
    tooltipBg: isDark ? "#0b1a32" : "#ffffff",
    tooltipBorder: isDark ? "#155e75" : "#cbd5e1",
    revenue: isDark ? "#38bdf8" : "#0369a1",
    adjusted: isDark ? "#22c55e" : "#16a34a",
    areaStroke: isDark ? "#22d3ee" : "#0891b2",
    areaFill: isDark ? "#0891b2" : "#67e8f9",
    waterfall: isDark ? "#2dd4bf" : "#0d9488",
    riskLowBand: isDark ? "rgba(34, 197, 94, 0.25)" : "rgba(34, 197, 94, 0.18)",
    riskWatchBand: isDark ? "rgba(245, 158, 11, 0.24)" : "rgba(245, 158, 11, 0.2)",
    riskHighBand: isDark ? "rgba(244, 63, 94, 0.24)" : "rgba(244, 63, 94, 0.2)",
    riskLowDot: isDark ? "#22c55e" : "#16a34a",
    riskWatchDot: isDark ? "#f59e0b" : "#d97706",
    riskHighDot: isDark ? "#f43f5e" : "#e11d48",
  };
}

export function TrendLineChart({ data, expanded = false }: { data: Array<Record<string, string | number>>; expanded?: boolean }) {
  const p = useChartPalette();
  return (
    <div className={expanded ? "h-[420px]" : "h-64"}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke={p.grid} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: p.tick }} axisLine={{ stroke: p.axis }} tickLine={{ stroke: p.axis }} />
          <YAxis tick={{ fontSize: 11, fill: p.tick }} axisLine={{ stroke: p.axis }} tickLine={{ stroke: p.axis }} />
          <Tooltip
            formatter={(value: number) => numberFormat(value)}
            contentStyle={{ backgroundColor: p.tooltipBg, borderColor: p.tooltipBorder, color: p.axis, borderRadius: 10 }}
            itemStyle={{ color: p.axis }}
            labelStyle={{ color: p.axis }}
          />
          <Legend wrapperStyle={{ color: p.axis }} />
          <Line type="monotone" dataKey="revenue" stroke={p.revenue} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
          <Line type="monotone" dataKey="adjustedEbitda" stroke={p.adjusted} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaTrendChart({ data, keyName, expanded = false }: { data: Array<Record<string, string | number>>; keyName: string; expanded?: boolean }) {
  const p = useChartPalette();
  return (
    <div className={expanded ? "h-[420px]" : "h-64"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke={p.grid} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: p.tick }} axisLine={{ stroke: p.axis }} tickLine={{ stroke: p.axis }} />
          <YAxis tick={{ fontSize: 11, fill: p.tick }} axisLine={{ stroke: p.axis }} tickLine={{ stroke: p.axis }} />
          <Tooltip
            formatter={(value: number) => numberFormat(value)}
            contentStyle={{ backgroundColor: p.tooltipBg, borderColor: p.tooltipBorder, color: p.axis, borderRadius: 10 }}
            itemStyle={{ color: p.axis }}
            labelStyle={{ color: p.axis }}
          />
          <Area type="monotone" dataKey={keyName} stroke={p.areaStroke} fill={p.areaFill} fillOpacity={p.isDark ? 0.58 : 0.45} strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarCompareChart({ data, xKey, bars, expanded = false }: { data: Array<Record<string, string | number>>; xKey: string; bars: Array<{ key: string; color: string }>; expanded?: boolean }) {
  const p = useChartPalette();
  return (
    <div className={expanded ? "h-[420px]" : "h-64"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke={p.grid} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: p.tick }} axisLine={{ stroke: p.axis }} tickLine={{ stroke: p.axis }} />
          <YAxis tick={{ fontSize: 11, fill: p.tick }} axisLine={{ stroke: p.axis }} tickLine={{ stroke: p.axis }} />
          <Tooltip
            formatter={(value: number) => numberFormat(value)}
            contentStyle={{ backgroundColor: p.tooltipBg, borderColor: p.tooltipBorder, color: p.axis, borderRadius: 10 }}
            itemStyle={{ color: p.axis }}
            labelStyle={{ color: p.axis }}
          />
          <Legend wrapperStyle={{ color: p.axis }} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} fill={b.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskZoneMapChart({ data, expanded = false }: { data: Array<{ subject: string; score: number }>; expanded?: boolean }) {
  const p = useChartPalette();
  const plotted = data.map((row) => ({
    ...row,
    zone: row.score >= 7 ? "High" : row.score >= 4.5 ? "Watch" : "Low",
  }));
  const riskTicks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const zoneColor = (score: number) => (score >= 7 ? p.riskHighDot : score >= 4.5 ? p.riskWatchDot : p.riskLowDot);

  return (
    <div className={expanded ? "h-[420px]" : "h-72"}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <ReferenceArea x1={1} x2={4.5} fill={p.riskLowBand} fillOpacity={1} />
          <ReferenceArea x1={4.5} x2={7} fill={p.riskWatchBand} fillOpacity={1} />
          <ReferenceArea x1={7} x2={10} fill={p.riskHighBand} fillOpacity={1} />
          <CartesianGrid strokeDasharray="4 4" stroke={p.grid} />
          <XAxis
            type="number"
            dataKey="score"
            domain={[1, 10]}
            ticks={riskTicks}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: p.tick }}
            axisLine={{ stroke: p.axis }}
            tickLine={{ stroke: p.axis }}
            label={{ value: "Risk Score", position: "insideBottom", offset: -8, fill: p.tick }}
          />
          <YAxis type="category" dataKey="subject" tick={{ fontSize: 11, fill: p.tick }} width={142} axisLine={{ stroke: p.axis }} tickLine={{ stroke: p.axis }} />
          <Tooltip
            cursor={{ strokeDasharray: "4 4" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload?.[0]?.payload as { subject: string; zone: string } | undefined;
              const score = Number(payload[0]?.value ?? 0);
              if (!point) return null;
              return (
                <div className="rounded border bg-card p-2 text-xs shadow-soft">
                  <p className="font-semibold">{point.subject}</p>
                  <p>score: {score.toFixed(1)} / 10</p>
                  <p>zone: {point.zone}</p>
                </div>
              );
            }}
          />
          <Scatter data={plotted} fill="#0ea5e9" shape="circle">
            {plotted.map((entry, index) => (
              <Cell key={`${entry.subject}-${index}`} fill={zoneColor(entry.score)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WaterfallLikeChart({ data, expanded = false }: { data: Array<{ step: string; value: number }>; expanded?: boolean }) {
  const p = useChartPalette();
  return (
    <div className={expanded ? "h-[420px]" : "h-64"}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke={p.grid} />
          <XAxis dataKey="step" tick={{ fontSize: 11, fill: p.tick }} axisLine={{ stroke: p.axis }} tickLine={{ stroke: p.axis }} />
          <YAxis tick={{ fontSize: 11, fill: p.tick }} axisLine={{ stroke: p.axis }} tickLine={{ stroke: p.axis }} />
          <Tooltip
            formatter={(value: number) => numberFormat(value)}
            contentStyle={{ backgroundColor: p.tooltipBg, borderColor: p.tooltipBorder, color: p.axis, borderRadius: 10 }}
            itemStyle={{ color: p.axis }}
            labelStyle={{ color: p.axis }}
          />
          <Bar dataKey="value" fill={p.waterfall} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
