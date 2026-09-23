export interface SnapshotRow {
  placeId: string;
  name: string;
  reviewCount?: number | null;
  gelPrice?: number | null;
  pedicurePrice?: number | null;
  acrylicPrice?: number | null;
  distanceMiles?: number | null;
  services?: string[];
}

export interface MarketEventDraft {
  placeId?: string;
  competitorName: string;
  kind:
    | "price_drop"
    | "price_rise"
    | "reviews_gained"
    | "service_added"
    | "new_competitor"
    | "competitor_closed";
  severity: "alert" | "positive" | "info";
  title: string;
  previousValue?: string;
  nextValue?: string;
}

const PRICE_DELTA = 2;
const REVIEW_DELTA = 5;

function money(value: number) {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(0)}`;
}

function priceEvents(
  row: SnapshotRow,
  label: "gel" | "pedicure" | "acrylic",
  previous?: number | null,
  next?: number | null
): MarketEventDraft[] {
  if (previous == null || next == null) return [];
  const delta = next - previous;
  if (Math.abs(delta) < PRICE_DELTA) return [];
  const dropped = delta < 0;
  return [
    {
      placeId: row.placeId,
      competitorName: row.name,
      kind: dropped ? "price_drop" : "price_rise",
      severity: dropped ? "alert" : "info",
      title: `${row.name} ${dropped ? "dropped" : "raised"} ${label} price ${money(previous)} → ${money(next)}`,
      previousValue: money(previous),
      nextValue: money(next),
    },
  ];
}

function normalizeService(name: string) {
  return name.trim().toLowerCase();
}

export function diffSnapshots(previous: SnapshotRow[], next: SnapshotRow[]): MarketEventDraft[] {
  if (!previous.length) return [];

  const before = new Map(previous.map((row) => [row.placeId, row]));
  const after = new Map(next.map((row) => [row.placeId, row]));
  const events: MarketEventDraft[] = [];

  for (const row of next) {
    const prior = before.get(row.placeId);
    if (!prior) {
      const miles = row.distanceMiles != null ? `${row.distanceMiles.toFixed(1)} mi away` : "nearby";
      events.push({
        placeId: row.placeId,
        competitorName: row.name,
        kind: "new_competitor",
        severity: "alert",
        title: `New salon opened ${miles}`,
        nextValue: row.name,
      });
      continue;
    }

    events.push(
      ...priceEvents(row, "gel", prior.gelPrice, row.gelPrice),
      ...priceEvents(row, "pedicure", prior.pedicurePrice, row.pedicurePrice),
      ...priceEvents(row, "acrylic", prior.acrylicPrice, row.acrylicPrice)
    );

    if (prior.reviewCount != null && row.reviewCount != null) {
      const gained = row.reviewCount - prior.reviewCount;
      if (gained >= REVIEW_DELTA) {
        events.push({
          placeId: row.placeId,
          competitorName: row.name,
          kind: "reviews_gained",
          severity: "positive",
          title: `${row.name} gained ${gained} reviews`,
          previousValue: String(prior.reviewCount),
          nextValue: String(row.reviewCount),
        });
      }
    }

    const priorServices = (prior.services || []).map(normalizeService).filter(Boolean);
    const nextServices = row.services || [];
    if (priorServices.length && nextServices.length) {
      const known = new Set(priorServices);
      for (const service of nextServices) {
        if (!service.trim() || known.has(normalizeService(service))) continue;
        events.push({
          placeId: row.placeId,
          competitorName: row.name,
          kind: "service_added",
          severity: "info",
          title: `${row.name} added "${service.trim()}"`,
          nextValue: service.trim(),
        });
      }
    }
  }

  for (const row of previous) {
    if (after.has(row.placeId)) continue;
    events.push({
      placeId: row.placeId,
      competitorName: row.name,
      kind: "competitor_closed",
      severity: "info",
      title: `${row.name} no longer appears in this market`,
      previousValue: row.name,
    });
  }

  return events;
}

export function eventMark(severity: string) {
  if (severity === "alert") return "🔴";
  if (severity === "positive") return "🟢";
  return "🟡";
}
