import { competitiveScore, dataConfidence } from "./competitorScore.js";
import { isDataPoint, readPositive, weightedAverage } from "../provenance";

function priceCell(field) {
  const value = readPositive(field);
  if (value == null) return "";
  if (!isDataPoint(field)) return value;
  return `${value} (${field.source}, ${Math.round(field.confidence * 100)}%)`;
}

export function buildMarketSnapshot(competitors = []) {
  const list = Array.isArray(competitors) ? competitors : [];
  const scored = list.map((competitor) => ({
    ...competitor,
    threatScore: competitiveScore(competitor),
  }));

  const topThreat = [...scored].sort((a, b) => b.threatScore - a.threatScore)[0] || null;
  const cheapestGel = [...scored]
    .filter((competitor) => readPositive(competitor.samplePrices?.gel) != null)
    .sort((a, b) => readPositive(a.samplePrices.gel) - readPositive(b.samplePrices.gel))[0] || null;

  const priceRanges = new Set(scored.map((competitor) => competitor.priceRange).filter(Boolean));
  let gap = "This area already covers budget, mid, and premium pricing.";
  if (!priceRanges.has("$")) gap = "Budget ($) shops are thin here. A lower-priced menu could stand out.";
  else if (!priceRanges.has("$$")) gap = "Mid-range ($$) is open. That is often the easiest local gap to fill.";
  else if (!priceRanges.has("$$$") && !priceRanges.has("$$$$")) {
    gap = "Premium ($$$) is light. Higher-ticket services may have room.";
  }

  return {
    count: scored.length,
    avgGel: weightedAverage(scored.map((competitor) => competitor.samplePrices?.gel)) || 0,
    avgPedicure: weightedAverage(scored.map((competitor) => competitor.samplePrices?.pedicure)) || 0,
    avgAcrylic: weightedAverage(scored.map((competitor) => competitor.samplePrices?.acrylic)) || 0,
    avgRating: Number(
      (
        scored.reduce((sum, competitor) => sum + (Number(competitor.rating) || 0), 0) /
        Math.max(scored.length, 1)
      ).toFixed(1)
    ),
    topThreat,
    cheapestGel,
    gap,
  };
}

export function formatBriefing(snapshot, address = "this area") {
  if (!snapshot?.count) return `No competitors found near ${address}.`;

  const threat = snapshot.topThreat
    ? `${snapshot.topThreat.name} (score ${snapshot.topThreat.threatScore})`
    : "n/a";

  return [
    `SpaAtlas briefing for ${address}`,
    `${snapshot.count} nearby competitors, average rating ${snapshot.avgRating}`,
    `Confidence-weighted prices: gel $${snapshot.avgGel}, pedicure $${snapshot.avgPedicure}, acrylic $${snapshot.avgAcrylic}`,
    `Strongest nearby threat: ${threat}`,
    snapshot.gap,
  ].join("\n");
}

export function competitorsToCsv(competitors = []) {
  const rows = [
    ["Name", "Rating", "Reviews", "Price", "Gel", "Pedicure", "Acrylic", "Distance (mi)", "Threat", "Data confidence"],
  ];

  competitors.forEach((competitor) => {
    rows.push([
      competitor.name || "",
      competitor.rating ?? "",
      competitor.reviewCount ?? "",
      competitor.priceRange || "",
      priceCell(competitor.samplePrices?.gel),
      priceCell(competitor.samplePrices?.pedicure),
      priceCell(competitor.samplePrices?.acrylic),
      competitor.distanceMiles ?? "",
      competitiveScore(competitor),
      dataConfidence(competitor),
    ]);
  });

  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

export function downloadCsv(filename, csv) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
