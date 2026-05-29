"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [materiality, setMateriality] = useState("75000");
  const [tolerance, setTolerance] = useState("0.50");
  const [conv60, setConv60] = useState("60");
  const [conv30, setConv30] = useState("30");
  const [conv0, setConv0] = useState("0");

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Settings</h2>
      <Card>
        <CardHeader><CardTitle>Configurable parameters</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Materiality threshold<input value={materiality} onChange={(e) => setMateriality(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Tie-out tolerance %<input value={tolerance} onChange={(e) => setTolerance(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Cash conversion threshold (&lt;60)<input value={conv60} onChange={(e) => setConv60(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Cash conversion threshold (&lt;30)<input value={conv30} onChange={(e) => setConv30(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
          <label className="text-sm">Cash conversion threshold (&lt;0)<input value={conv0} onChange={(e) => setConv0(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Mapping Studio (placeholder)</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">In the next phase, this section will include mapping dictionaries, account-rule templates, and governance workflows.</CardContent>
      </Card>
      <Button>Save configuration</Button>
    </div>
  );
}
