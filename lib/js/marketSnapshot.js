import { competitiveScore } from "./competitorScore.js";

function avg(values) {
  const numbers = values.filter((value) => Number.isFinite(value) && value > 0);
  if (numbers.length === 0) return 0;
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}

export function buildMarketSnapshot(competitors = []) {
  const list = Array.isArray(competitors) ? competitors : [];
  const scored = list.map((competitor) => ({
    ...competitor,
    threatScore: competitiveScore(competitor),
  }));

  const topThreat = [...scored].sort((a, b) => b.threatScore - a.threatScore)[0] || null;
  const cheapestGel = [...scored]
    .filter((competitor) => competitor.samplePrices?.gel)
    .sort((a, b) => a.samplePrices.gel - b.samplePrices.gel)[0] || null;

  const priceRanges = new Set(scored.map((competitor) => competitor.priceRange).filter(Boolean));
  let gap = "This area already covers budget, mid, and premium pricing.";
  if (!priceRanges.has("$")) gap = "Budget ($) shops are thin here. A lower-priced menu could stand out.";
  else if (!priceRanges.has("$$")) gap = "Mid-range ($$) is open. That is often the easiest local gap to fill.";
  else if (!priceRanges.has("$$$") && !priceRanges.has("$$$$")) {
    gap = "Premium ($$$) is light. Higher-ticket services may have room.";
  }

  return {
    count: scored.length,
    avgGel: avg(scored.map((competitor) => Number(competitor.samplePrices?.gel))),
    avgPedicure: avg(scored.map((competitor) => Number(competitor.samplePrices?.pedicure))),
    avgAcrylic: avg(scored.map((competitor) => Number(competitor.samplePrices?.acrylic))),
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
    `Average prices: gel $${snapshot.avgGel}, pedicure $${snapshot.avgPedicure}, acrylic $${snapshot.avgAcrylic}`,
    `Strongest nearby threat: ${threat}`,
    snapshot.gap,
  ].join("\n");
}

export function competitorsToCsv(competitors = []) {
  const rows = [
    ["Name", "Rating", "Reviews", "Price", "Gel", "Pedicure", "Acrylic", "Distance (mi)", "Threat"],
  ];

  competitors.forEach((competitor) => {
    rows.push([
      competitor.name || "",
      competitor.rating ?? "",
      competitor.reviewCount ?? "",
      competitor.priceRange || "",
      competitor.samplePrices?.gel ?? "",
      competitor.samplePrices?.pedicure ?? "",
      competitor.samplePrices?.acrylic ?? "",
      competitor.distanceMiles ?? "",
      competitiveScore(competitor),
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
