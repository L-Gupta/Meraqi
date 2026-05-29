"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartDrilldownModal } from "@/components/modals/chart-drilldown-modal";
import { LineageStepSchema } from "@/lib/schemas/types";
import { z } from "zod";
import type { ReactNode } from "react";

type LineageStep = z.infer<typeof LineageStepSchema>;

export function ChartCard({
  title,
  renderChart,
  steps,
}: {
  title: string;
  renderChart: (expanded: boolean) => ReactNode;
  steps: LineageStep[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="cursor-pointer" onClick={() => setOpen(true)}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{renderChart(false)}</CardContent>
      </Card>
      <ChartDrilldownModal open={open} onOpenChange={setOpen} title={title} renderChart={renderChart} steps={steps} />
    </>
  );
}
