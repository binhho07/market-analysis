"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import {
  buildMarketSnapshot,
  competitorsToCsv,
  downloadCsv,
  formatBriefing,
} from "@/lib/js/marketSnapshot.js";

interface MarketSnapshotProps {
  competitors: any[];
  address?: string;
}

export function MarketSnapshot({ competitors, address }: MarketSnapshotProps) {
  const snapshot = buildMarketSnapshot(competitors);

  const handleCopy = async () => {
    const briefing = formatBriefing(snapshot, address);
    await navigator.clipboard.writeText(briefing);
    toast.success("Market briefing copied");
  };

  const handleCsv = () => {
    downloadCsv(
      `spa-atlas-${Date.now()}.csv`,
      competitorsToCsv(competitors)
    );
    toast.success("CSV downloaded");
  };

  return (
    <Card className="rounded-xl shadow-lg border border-gray-200 bg-white">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-2xl font-bold text-black">Market snapshot</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy briefing
          </Button>
          <Button variant="outline" size="sm" onClick={handleCsv}>
            <Download className="mr-2 h-4 w-4" />
            Quick CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Competitors" value={String(snapshot.count)} />
          <Stat label="Avg rating" value={String(snapshot.avgRating)} />
          <Stat label="Avg gel" value={snapshot.avgGel ? `$${snapshot.avgGel}` : "—"} />
          <Stat label="Avg pedicure" value={snapshot.avgPedicure ? `$${snapshot.avgPedicure}` : "—"} />
        </div>
        <p className="text-sm text-gray-700">
          Strongest nearby threat:{" "}
          <span className="font-semibold text-black">
            {snapshot.topThreat?.name || "n/a"}
          </span>
          {snapshot.topThreat ? ` (score ${snapshot.topThreat.threatScore})` : ""}
        </p>
        <p className="text-sm text-gray-600">{snapshot.gap}</p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-black">{value}</p>
    </div>
  );
}
