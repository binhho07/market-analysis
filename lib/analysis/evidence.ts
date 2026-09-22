export type EvidenceSource = "places" | "scraped" | "estimated" | "derived";

export interface EvidenceItem {
  competitor: string;
  field: string;
  value: string | number | null;
  source: EvidenceSource;
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
    gel?: number | null;
    pedicure?: number | null;
    acrylic?: number | null;
  };
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function avg(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

function priceSource(competitor: CompetitorRecord): EvidenceSource {
  return competitor.priceSource === "scraped" ? "scraped" : competitor.priceSource === "estimated" ? "estimated" : "places";
}

function sourceDetail(competitor: CompetitorRecord): string {
  if (competitor.priceSource === "scraped" && competitor.website && competitor.website !== "#") {
    return competitor.website;
  }
  if (competitor.priceSource === "estimated") {
    return `estimated from listed tier ${competitor.priceRange || "unknown"}`;
  }
  return competitor.address || "places listing";
}

function threatScore(competitor: CompetitorRecord): number {
  const rating = Number(competitor.rating) || 0;
  const reviews = Number(competitor.reviewCount) || 0;
  const distance = Math.max(Number(competitor.distanceMiles) || 1, 0.1);
  return Math.min(Math.round(((rating * Math.log(reviews + 1)) / distance) * 10), 100);
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
  const scrapedCount = list.filter((item) => item.priceSource === "scraped").length;
  const scrapedShare = n ? scrapedCount / n : 0;
  const findings: Finding[] = [];

  const gels = list.map((item) => num(item.samplePrices?.gel));
  const pedis = list.map((item) => num(item.samplePrices?.pedicure));
  const acrylics = list.map((item) => num(item.samplePrices?.acrylic));
  const ratings = list.map((item) => num(item.rating));

  findings.push({
    id: "F1",
    finding: "sample_profile",
    title: "Sample covered in this search",
    confidence: confidenceFromSample(n, scrapedShare),
    method: "Count of returned competitors; no external market-size estimate.",
    metrics: {
      competitorCount: n,
      avgRating: avg(ratings),
      scrapedPriceCount: scrapedCount,
      estimatedPriceCount: n - scrapedCount,
    },
    evidence: list.slice(0, 12).map((item) => ({
      competitor: item.name,
      field: "listing",
      value: item.rating ?? null,
      source: "places",
      detail: `${item.reviewCount || 0} reviews · ${item.distanceMiles ?? "?"} mi`,
    })),
  });

  findings.push({
    id: "F2",
    finding: "price_benchmarks",
    title: "Observed service prices in this sample",
    confidence: confidenceFromSample(n, scrapedShare),
    method: "Average of positive observed prices only. Missing prices are excluded, not imputed into the average.",
    metrics: {
      avgGel: avg(gels),
      avgPedicure: avg(pedis),
      avgAcrylic: avg(acrylics),
      gelObservations: gels.filter((value) => value !== null).length,
    },
    evidence: list.flatMap((item) =>
      (
        [
          ["gel", item.samplePrices?.gel],
          ["pedicure", item.samplePrices?.pedicure],
          ["acrylic", item.samplePrices?.acrylic],
        ] as const
      )
        .filter(([, value]) => num(value) !== null)
        .map(([field, value]) => ({
          competitor: item.name,
          field,
          value: num(value),
          source: priceSource(item),
          detail: sourceDetail(item),
        }))
    ),
  });

  const cheapestGel = [...list]
    .filter((item) => num(item.samplePrices?.gel) !== null)
    .sort((a, b) => (num(a.samplePrices?.gel) || 0) - (num(b.samplePrices?.gel) || 0))[0];

  if (cheapestGel) {
    findings.push({
      id: "F3",
      finding: "lowest_gel_price",
      title: "Lowest gel price in this sample",
      confidence: cheapestGel.priceSource === "scraped" ? 0.86 : 0.58,
      method: "Min gel price among competitors with a positive gel value.",
      metrics: {
        competitor: cheapestGel.name,
        gel: num(cheapestGel.samplePrices?.gel),
        sampleAvgGel: avg(gels),
      },
      evidence: [
        {
          competitor: cheapestGel.name,
          field: "gel",
          value: num(cheapestGel.samplePrices?.gel),
          source: priceSource(cheapestGel),
          detail: sourceDetail(cheapestGel),
        },
      ],
    });
  }

  const scored = list.map((item) => ({ item, score: threatScore(item) }));
  const topThreat = [...scored].sort((a, b) => b.score - a.score)[0];
  if (topThreat) {
    findings.push({
      id: "F4",
      finding: "strongest_nearby_threat",
      title: "Highest proximity-weighted threat score",
      confidence: 0.72,
      method: "score = min(100, round((rating * ln(reviews+1) / max(distanceMiles, 0.1)) * 10)). This is a local ranking heuristic, not a predicted conversion rate.",
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
