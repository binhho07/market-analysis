"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { EvidenceItem, EvidencePack, Finding } from "@/lib/analysis/evidence";
import type { GroundedReport } from "@/lib/analysis/llm-report";
import type { AnalysisInsights } from "@/lib/analysis/types";

interface AIInsightsProps {
  competitors: any[];
  insights?: AnalysisInsights | null;
  address?: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

function confidenceLabel(value: number) {
  if (value >= 0.8) return "high";
  if (value >= 0.6) return "medium";
  return "thin sample";
}

function EvidenceTable({ items }: { items: EvidenceItem[] }) {
  const rows = items.slice(0, 16);
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">Competitor</th>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Value</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={`${item.competitor}-${item.field}-${index}`} className="border-t border-gray-100">
              <td className="px-3 py-2 text-gray-900">{item.competitor}</td>
              <td className="px-3 py-2 text-gray-600">{item.field}</td>
              <td className="px-3 py-2 text-gray-900">{item.value ?? "—"}</td>
              <td className="px-3 py-2 text-gray-600">
                <span className="font-medium">{item.source}</span>
                {item.detail ? <span className="block text-xs text-gray-500">{item.detail}</span> : null}
              </td>
              <td className="px-3 py-2 text-gray-600">
                {item.confidence != null ? `${Math.round(item.confidence * 100)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > rows.length ? (
        <p className="px-3 py-2 text-xs text-gray-500">Showing {rows.length} of {items.length} evidence rows.</p>
      ) : null}
    </div>
  );
}

function WhyPanel({ finding }: { finding: Finding }) {
  return (
    <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="rounded-full bg-white px-2 py-1 font-medium text-gray-800">
          {finding.finding}
        </span>
        <span>confidence {finding.confidence} ({confidenceLabel(finding.confidence)})</span>
      </div>
      <p className="text-sm text-gray-700">{finding.method}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {Object.entries(finding.metrics).map(([key, value]) => (
          <div key={key} className="rounded-md bg-white px-2 py-1.5">
            <dt className="text-gray-500">{key}</dt>
            <dd className="font-medium text-gray-900">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <EvidenceTable items={finding.evidence} />
    </div>
  );
}

export function AIInsights({
  competitors,
  insights,
  address,
  lat,
  lng,
  radius,
}: AIInsightsProps) {
  const [pack, setPack] = useState<EvidencePack | null>(insights?.evidence ?? null);
  const [report, setReport] = useState<GroundedReport | null>(insights?.report ?? null);
  const [openFinding, setOpenFinding] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (insights?.evidence && insights?.report) {
      setPack(insights.evidence);
      setReport(insights.report);
      return;
    }

    if (!competitors.length) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const response = await apiClient.generateInsights({
        competitors,
        address,
        lat,
        lng,
        radius,
      });
      if (cancelled) return;
      if (response.success && response.data) {
        setPack(response.data.evidence);
        setReport(response.data.report);
      } else {
        setError(response.error?.message || "Could not build a grounded report");
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [address, competitors, insights, lat, lng, radius]);

  const findingsById = useMemo(() => {
    const map = new Map<string, Finding>();
    pack?.findings.forEach((finding) => map.set(finding.id, finding));
    return map;
  }, [pack]);

  return (
    <Card className="rounded-xl border border-gray-200 bg-white shadow-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-2xl font-bold text-black">AI Insights</CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Deterministic metrics first. The model may only write from that evidence JSON.
          </p>
        </div>
        {report ? (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
            report.mode === "llm"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800"
          }`}>
            {report.mode === "llm" ? `Grounded LLM · ${report.model}` : "Deterministic summary · no LLM key"}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? <p className="text-sm text-gray-600">Building evidence, then the report…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {report ? (
          <>
            <p className="text-base leading-relaxed text-gray-800">{report.summary}</p>
            <ol className="space-y-4">
              {report.claims.map((claim) => {
                const finding = findingsById.get(claim.findingId);
                const isOpen = openFinding === claim.id;
                return (
                  <li key={claim.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <p className="text-sm leading-relaxed text-gray-800">{claim.text}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setOpenFinding(isOpen ? null : claim.id)}
                      >
                        {isOpen ? "Hide" : "Why?"}
                      </Button>
                    </div>
                    {isOpen && finding ? <WhyPanel finding={finding} /> : null}
                    {isOpen && !finding ? (
                      <p className="mt-3 text-sm text-gray-500">This claim was dropped from the evidence pack.</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {pack ? (
              <p className="text-xs text-gray-500">
                {pack.sampleSize} competitors · {pack.findings.length} findings · generated {new Date(pack.generatedAt).toLocaleString()}
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
