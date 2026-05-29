"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobalStore } from "@/lib/store/use-global-store";

export default function NotesPage() {
  const { notes, setNotes, addReportDraft, reportDraft } = useGlobalStore();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Notes</h2>
      <Card>
        <CardHeader><CardTitle>Analyst Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Capture assumptions, management commentary, and unresolved tie-outs..." />
          <div className="flex gap-2">
            <Button onClick={() => setSavedAt(new Date().toLocaleString())}>Save</Button>
            <Button variant="outline" onClick={() => {
              const selected = typeof window !== "undefined" ? window.getSelection()?.toString() : "";
              if (selected) addReportDraft(selected);
            }}>Add selected text to Report Narrative</Button>
          </div>
          {savedAt ? <p className="text-xs text-muted-foreground">Saved at {savedAt}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Report Draft Snippets</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {reportDraft.length === 0 ? <p className="text-sm text-muted-foreground">No methodology snippets yet.</p> : reportDraft.map((snippet, i) => (
            <div key={i} className="rounded border bg-card p-2 text-sm">{snippet}</div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
