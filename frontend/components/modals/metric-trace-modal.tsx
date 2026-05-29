"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Metric } from "@/lib/schemas/types";
import { useRouter } from "next/navigation";
import { useGlobalStore } from "@/lib/store/use-global-store";

export function MetricTraceModal({
  open,
  onOpenChange,
  metric,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: Metric;
}) {
  const router = useRouter();
  const { addReportDraft } = useGlobalStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogTitle className="text-lg font-semibold">{metric.label} - {metric.value}</DialogTitle>
        <Tabs defaultValue="lineage">
          <TabsList>
            <TabsTrigger value="lineage">Lineage</TabsTrigger>
            <TabsTrigger value="trace">Cell Trace</TabsTrigger>
          </TabsList>
          <TabsContent value="lineage" className="space-y-3">
            {metric.lineage.map((step, idx) => (
              <div key={step.title} className="rounded-lg border bg-muted/35 p-3">
                <p className="text-xs uppercase text-muted-foreground">Step {idx + 1}</p>
                <p className="font-semibold">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                <p className="mt-2 text-xs">Refs: {step.references.join(" | ")}</p>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="trace">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <THead>
                  <TR>
                    <TH>Step</TH><TH>Source (file/sheet/range)</TH><TH>Logic/Formula</TH><TH>Value</TH>
                  </TR>
                </THead>
                <TBody>
                  {metric.cellTrace.map((row) => (
                    <TR key={row.step}>
                      <TD>{row.step}</TD>
                      <TD>{row.source}</TD>
                      <TD>{row.logic}</TD>
                      <TD>{row.value}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/documents?file=TB_FY24.xlsx&line=Revenue")}>Open Source Viewer</Button>
          <Button onClick={() => addReportDraft(`${metric.label}: ${metric.value} | ${metric.lineage[2]?.description ?? "formula trace"}`)}>
            Add to Report Methodology
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
