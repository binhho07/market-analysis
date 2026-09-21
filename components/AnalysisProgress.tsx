"use client";

import { Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisJobPublic, AnalysisProgress, StageStatus } from "@/lib/analysis/types";

const ORDER: Array<keyof AnalysisProgress> = ["places", "websites", "prices", "insights"];

function countLabel(status: StageStatus, current: number, total: number) {
  if (status === "done") return "✓";
  if (status === "pending") return "...";
  if (status === "failed") return "failed";
  if (!total) return "...";
  return `${current}/${total}`;
}

export function AnalysisProgress({ job }: { job: AnalysisJobPublic }) {
  return (
    <Card className="rounded-xl border border-gray-200 bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-black">Analysis pipeline</CardTitle>
        <p className="text-sm text-gray-600">
          Job {job.id.slice(0, 8)} · {job.status}
          {job.error ? ` · ${job.error}` : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {ORDER.map((key) => {
          const stage = job.progress[key];
          const running = stage.status === "running";
          const done = stage.status === "done";
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {done ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : running ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-700" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-gray-300" />
                )}
                <span className={`text-sm ${done || running ? "text-black" : "text-gray-500"}`}>
                  {stage.label}
                </span>
              </div>
              <span className="font-mono text-sm text-gray-700">
                {countLabel(stage.status, stage.current, stage.total)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
