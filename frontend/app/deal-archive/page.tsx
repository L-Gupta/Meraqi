"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteArchivedDeal,
  getArchivedDeals,
  getDeletedDeals,
  permanentlyDeleteFromRecentlyDeleted,
  purgeExpiredDeletedDeals,
  restoreDeletedDeal,
  type ArchivedDeal,
  type DeletedDeal,
} from "@/lib/deals/deal-lifecycle";

function daysUntil(date: string) {
  const now = Date.now();
  const target = new Date(date).getTime();
  const days = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export default function DealArchivePage() {
  const [archived, setArchived] = useState<ArchivedDeal[]>([]);
  const [deleted, setDeleted] = useState<DeletedDeal[]>([]);

  const refresh = () => {
    purgeExpiredDeletedDeals();
    setArchived(getArchivedDeals());
    setDeleted(getDeletedDeals());
  };

  useEffect(() => {
    refresh();
  }, []);

  const deletedWithCountdown = useMemo(
    () => deleted.map((deal) => ({ ...deal, daysLeft: daysUntil(deal.purgeAt) })),
    [deleted]
  );

  const onViewDeal = (deal: ArchivedDeal) => {
    const ok = window.confirm(`Open archived view for ${deal.companyName}?`);
    if (!ok) return;
    window.open(`/dashboard?archivedId=${encodeURIComponent(deal.id)}`, "_blank", "noopener,noreferrer");
  };

  const onDeleteArchived = (deal: ArchivedDeal) => {
    const ok = window.confirm(`Move archived deal ${deal.companyName} to Recently Deleted?`);
    if (!ok) return;
    deleteArchivedDeal(deal.id);
    refresh();
  };

  const onRestoreDeleted = (deal: DeletedDeal) => {
    const ok = window.confirm(`Restore ${deal.companyName} back to ${deal.source === "archived" ? "Archived Deals" : "Active Deals"}?`);
    if (!ok) return;
    restoreDeletedDeal(deal.id);
    refresh();
  };

  const onDeleteNow = (deal: DeletedDeal) => {
    const ok = window.confirm(`Permanently delete ${deal.companyName} now? This cannot be undone.`);
    if (!ok) return;
    permanentlyDeleteFromRecentlyDeleted(deal.id);
    refresh();
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Deal Archive</h2>

      <Card>
        <CardHeader>
          <CardTitle>Past Closed Deals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {archived.length === 0 ? <p className="text-sm text-muted-foreground">No archived deals yet.</p> : null}
          {archived.map((deal) => (
            <div key={deal.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-card p-3">
              <div>
                <p className="font-medium">{deal.companyName}</p>
                <p className="text-xs text-muted-foreground">Closed for {deal.closeValue} • {new Date(deal.closedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onViewDeal(deal)}>View Deal</Button>
                <Button size="sm" variant="outline" onClick={() => onDeleteArchived(deal)}>Delete Deal</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently Deleted (Auto delete in 15 days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deletedWithCountdown.length === 0 ? <p className="text-sm text-muted-foreground">No recently deleted deals.</p> : null}
          {deletedWithCountdown.map((deal) => (
            <div key={deal.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-card p-3">
              <div>
                <p className="font-medium">{deal.companyName}</p>
                <p className="text-xs text-muted-foreground">
                  Source: {deal.source} • Auto-delete in {deal.daysLeft} day(s)
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onRestoreDeleted(deal)}>Restore</Button>
                <Button size="sm" variant="outline" onClick={() => onDeleteNow(deal)}>Delete Now</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

