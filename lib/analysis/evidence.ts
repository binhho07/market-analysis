import {
  confidenceWeightedScore,
  inputConfidence,
  isDataPoint,
  readPositive,
  weightedAverage,
} from "@/lib/provenance";

export type EvidenceSource = "places" | "scraped" | "estimated" | "derived";

export interface EvidenceItem {
  competitor: string;
  field: string;
  value: string | number | null;
  source: EvidenceSource;
  confidence?: number;
  detail?: string;
}

export interface Finding {
  id: string;
  finding: string;
  title: string;
  confidence: number;
  method: string;
  metrics: Record<string, string | number | null>;
  evidence: EvidenceItem[];
}

export interface EvidencePack {
  generatedAt: string;
  search: {
    address?: string;
    lat?: number;
    lng?: number;
    radiusMiles?: number;
  };
  sampleSize: number;
  findings: Finding[];
}

export interface CompetitorRecord {
  id?: string;
  name: string;
  address?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  distanceMiles?: number;
  priceSource?: string;
  samplePrices?: {
    gel?: unknown;
    pedicure?: unknown;
    acrylic?: unknown;
  };
}

function pointSource(field: unknown, fallback: EvidenceSource = "estimated"): EvidenceSource {
  if (!isDataPoint(field)) return fallback;
  if (field.source === "website") return "scraped";
  if (field.source === "google") return "places";
  return "estimated";
}

function pointDetail(field: unknown, fallback: string): string {
  if (isDataPoint(field)) {
    const pct = Math.round(field.confidence * 100);
    return field.sourceUrl || `${field.source} · ${pct}% confidence`;
  }
  return fallback;
}

function hasVerifiedPrice(competitor: CompetitorRecord): boolean {
  return [competitor.samplePrices?.gel, competitor.samplePrices?.pedicure, competitor.samplePrices?.acrylic].some(
    (field) => isDataPoint(field) && field.source === "website"
  );
}

function confidenceFromSample(n: number, scrapedShare: number): number {
  const size = n >= 10 ? 0.9 : n >= 5 ? 0.75 : n >= 3 ? 0.55 : 0.35;
  return Math.round(Math.min(0.95, size * 0.7 + scrapedShare * 0.3) * 100) / 100;
}

export function buildEvidencePack(
  competitors: CompetitorRecord[],
  search: EvidencePack["search"] = {}
): EvidencePack {
  const list = Array.isArray(competitors) ? competitors.filter((item) => item?.name) : [];
  const n = list.length;
  const scrapedCount = list.filter((item) => hasVerifiedPrice(item) || item.priceSource === "scraped").length;
  const scrapedShare = n ? scrapedCount / n : 0;
  const findings: Finding[] = [];

  const gels = list.map((item) => item.samplePrices?.gel);
  const pedis = list.map((item) => item.samplePrices?.pedicure);
  const acrylics = list.map((item) => item.samplePrices?.acrylic);
  const ratings = list.map((item) => item.rating);

  findings.push({
    id: "F1",
    finding: "sample_profile",
    title: "Sample covered in this search",
    confidence: confidenceFromSample(n, scrapedShare),
    method: "Count of returned competitors; no external market-size estimate.",
    metrics: {
      competitorCount: n,
      avgRating: weightedAverage(ratings),
      scrapedPriceCount: scrapedCount,
      estimatedPriceCount: n - scrapedCount,
    },
    evidence: list.slice(0, 12).map((item) => ({
      competitor: item.name,
      field: "listing",
      value: readPositive(item.rating),
      confidence: 0.92,
      source: "places",
      detail: `${item.reviewCount || 0} reviews · ${item.distanceMiles ?? "?"} mi`,
    })),
  });

  findings.push({
    id: "F2",
    finding: "price_benchmarks",
    title: "Observed service prices in this sample",
    confidence: confidenceFromSample(n, scrapedShare),
    method: "Confidence-weighted average. A website price (96%) counts more than a tier estimate (41% or 25%). Missing prices are excluded.",
    metrics: {
      avgGel: weightedAverage(gels),
      avgPedicure: weightedAverage(pedis),
      avgAcrylic: weightedAverage(acrylics),
      gelObservations: gels.filter((value) => readPositive(value) !== null).length,
      verifiedGelCount: gels.filter((value) => isDataPoint(value) && value.source === "website").length,
    },
    evidence: list.flatMap((item) =>
      (
        [
          ["gel", item.samplePrices?.gel],
          ["pedicure", item.samplePrices?.pedicure],
          ["acrylic", item.samplePrices?.acrylic],
        ] as const
      )
        .filter(([, value]) => readPositive(value) !== null)
        .map(([field, value]) => ({
          competitor: item.name,
          field,
          value: readPositive(value),
          source: pointSource(value),
          confidence: isDataPoint(value) ? value.confidence : undefined,
          detail: pointDetail(value, item.address || "places listing"),
        }))
    ),
  });

  const cheapestGel = [...list]
    .filter((item) => readPositive(item.samplePrices?.gel) !== null)
    .sort((a, b) => (readPositive(a.samplePrices?.gel) || 0) - (readPositive(b.samplePrices?.gel) || 0))[0];

  if (cheapestGel) {
    const gel = cheapestGel.samplePrices?.gel;
    findings.push({
      id: "F3",
      finding: "lowest_gel_price",
      title: "Lowest gel price in this sample",
      confidence: isDataPoint(gel) ? gel.confidence : 0.4,
      method: "Minimum gel price. Confidence is the confidence of that price point, not of the whole market.",
      metrics: {
        competitor: cheapestGel.name,
        gel: readPositive(gel),
        sampleAvgGel: weightedAverage(gels),
      },
      evidence: [
        {
          competitor: cheapestGel.name,
          field: "gel",
          value: readPositive(gel),
          source: pointSource(gel),
          confidence: isDataPoint(gel) ? gel.confidence : undefined,
          detail: pointDetail(gel, cheapestGel.address || "places listing"),
        },
      ],
    });
  }

  const scored = list.map((item) => ({ item, score: confidenceWeightedScore(item) }));
  const topThreat = [...scored].sort((a, b) => b.score - a.score)[0];
  if (topThreat) {
    findings.push({
      id: "F4",
      finding: "strongest_nearby_threat",
      title: "Highest proximity-weighted threat score",
      confidence: inputConfidence(topThreat.item),
      method: "Base threat is rating * ln(reviews+1) / distance, capped at 100, then multiplied by data confidence. Confidence is 60% Google listing fields and 40% price-point confidence, so a tier estimate scores lower than a website price.",
      metrics: {
        competitor: topThreat.item.name,
        score: topThreat.score,
        rating: topThreat.item.rating ?? null,
        reviewCount: topThreat.item.reviewCount ?? null,
        distanceMiles: topThreat.item.distanceMiles ?? null,
      },
      evidence: scored.slice(0, 8).map(({ item, score }) => ({
        competitor: item.name,
        field: "threatScore",
        value: score,
        source: "derived",
        detail: `${item.rating ?? "?"}★ / ${item.reviewCount ?? 0} reviews / ${item.distanceMiles ?? "?"} mi`,
      })),
    });
  }

  const ranges = new Set(list.map((item) => item.priceRange).filter(Boolean));
  const missing = ["$", "$$", "$$$"].filter((tier) => !ranges.has(tier));
  findings.push({
    id: "F5",
    finding: missing[0] === "$$$" ? "premium_segment_gap" : missing[0] === "$" ? "budget_segment_gap" : missing[0] === "$$" ? "midrange_segment_gap" : "no_price_tier_gap",
    title: missing.length ? `Missing listed price tier: ${missing.join(", ")}` : "All common price tiers appear in the sample",
    confidence: n >= 8 ? 0.84 : n >= 4 ? 0.66 : 0.4,
    method: "Presence check on listed priceRange values ($, $$, $$$). Absence means the tier was not observed in this sample, not that demand is proven.",
    metrics: {
      observedTiers: Array.from(ranges).join(", ") || "none",
      missingTiers: missing.join(", ") || "none",
    },
    evidence: list.map((item) => ({
      competitor: item.name,
      field: "priceRange",
      value: item.priceRange || "unknown",
      source: "places",
      detail: item.address || "places listing",
    })),
  });

  const nearby = list.filter((item) => (item.distanceMiles || 99) < 1).length;
  const mid = list.filter((item) => {
    const miles = item.distanceMiles || 99;
    return miles >= 1 && miles < 3;
  }).length;
  findings.push({
    id: "F6",
    finding: "distance_bands",
    title: "How close the sample sits to the search point",
    confidence: 0.8,
    method: "Counts by distanceMiles bands: <1, 1–3, 3+.",
    metrics: {
      within1mi: nearby,
      from1to3mi: mid,
      beyond3mi: n - nearby - mid,
    },
    evidence: list.map((item) => ({
      competitor: item.name,
      field: "distanceMiles",
      value: item.distanceMiles ?? null,
      source: "derived",
      detail: item.address || "geocoded search point",
    })),
  });

  return {
    generatedAt: new Date().toISOString(),
    search,
    sampleSize: n,
    findings,
  };
}
