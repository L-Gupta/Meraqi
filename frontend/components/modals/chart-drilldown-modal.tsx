"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LineageStepSchema } from "@/lib/schemas/types";
import { z } from "zod";
import type { ReactNode } from "react";

type LineageStep = z.infer<typeof LineageStepSchema>;

export function ChartDrilldownModal({
  open,
  onOpenChange,
  title,
  renderChart,
  steps,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  renderChart: (expanded: boolean) => ReactNode;
  steps: LineageStep[];
}) {
  const [showSteps, setShowSteps] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <div className="mb-2 flex items-start justify-between gap-2 pr-8">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <Button variant="outline" size="sm" onClick={() => setShowSteps((v) => !v)}>
            View TAM Build Steps
          </Button>
        </div>
        <div className="rounded-lg border bg-card p-3">{renderChart(true)}</div>
        {showSteps ? (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 font-semibold">TAM Build Steps (Data provenance)</p>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="rounded border bg-card p-3">
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  <p className="mt-1 text-xs">References: {step.references.join(" | ")}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
