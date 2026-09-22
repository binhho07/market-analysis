export type DataSource = "google" | "website" | "estimated";

export type DataPoint<T> = {
  value: T;
  source: DataSource;
  confidence: number;
  sourceUrl?: string;
  fetchedAt: string;
};

export const GOOGLE_FIELD_CONFIDENCE = 0.92;
export const WEBSITE_PRICE_CONFIDENCE = 0.96;
export const TIER_ESTIMATE_CONFIDENCE = 0.41;
export const ASSUMED_TIER_CONFIDENCE = 0.25;
export const STAFF_INFERENCE_CONFIDENCE = 0.32;

type OpeningHours = {
  periods?: Array<{
    open?: { day?: number; time?: string };
    close?: { day?: number; time?: string };
  }>;
  weekdayText?: string[];
};

export function dataPoint<T>(
  value: T,
  source: DataSource,
  confidence: number,
  sourceUrl?: string
): DataPoint<T> {
  const point: DataPoint<T> = {
    value,
    source,
    confidence: Math.max(0, Math.min(1, Math.round(confidence * 100) / 100)),
    fetchedAt: new Date().toISOString(),
  };
  if (sourceUrl) point.sourceUrl = sourceUrl;
  return point;
}

export function isDataPoint(field: unknown): field is DataPoint<unknown> {
  if (!field || typeof field !== "object") return false;
  const point = field as DataPoint<unknown>;
  return "value" in point && "confidence" in point && (point.source === "google" || point.source === "website" || point.source === "estimated");
}

export function readValue<T>(field: T | DataPoint<T> | null | undefined): T | null {
  if (field == null) return null;
  if (isDataPoint(field)) return field.value as T;
  return field as T;
}

export function readNumeric(field: unknown): number | null {
  const raw = isDataPoint(field) ? field.value : field;
  if (raw == null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readPositive(field: unknown): number | null {
  const parsed = readNumeric(field);
  return parsed != null && parsed > 0 ? parsed : null;
}

export function readConfidence(field: unknown, fallback = 0): number {
  if (isDataPoint(field)) return field.confidence;
  return fallback;
}

export function describeProvenance(field: unknown): {
  mark: "●" | "◐" | "○";
  label: string;
  confidence: number;
} {
  if (!isDataPoint(field) || field.confidence <= 0 || field.value == null || (Array.isArray(field.value) && field.value.length === 0)) {
    return { mark: "○", label: "Not observed", confidence: 0 };
  }

  const pct = Math.round(field.confidence * 100);
  if (field.source === "website") {
    return { mark: "●", label: `Website verified · ${pct}% confidence`, confidence: field.confidence };
  }
  if (field.source === "google") {
    return { mark: "●", label: `Google listing · ${pct}% confidence`, confidence: field.confidence };
  }
  return { mark: "◐", label: `Estimated · ${pct}% confidence`, confidence: field.confidence };
}

export function weightedAverage(fields: unknown[]): number | null {
  let weighted = 0;
  let weight = 0;
  for (const field of fields) {
    const value = readPositive(field);
    const confidence = readConfidence(field, 0);
    if (value == null || confidence <= 0) continue;
    weighted += value * confidence;
    weight += confidence;
  }
  if (!weight) return null;
  return Math.round((weighted / weight) * 10) / 10;
}

export function pricePoint(
  value: number | null | undefined,
  source: "website" | "estimated",
  confidence: number,
  sourceUrl?: string
): DataPoint<number | null> {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return dataPoint(null, "estimated", 0, sourceUrl);
  }
  return dataPoint(value, source, confidence, sourceUrl);
}

export function staffBandFromReviews(reviewCount: number): DataPoint<string | null> {
  if (!reviewCount) return dataPoint(null, "estimated", 0);
  const band = reviewCount > 200 ? "8+" : reviewCount > 100 ? "4-7" : "1-3";
  return dataPoint(band, "estimated", STAFF_INFERENCE_CONFIDENCE);
}

function minutesFromClock(hour: number, minute: number, meridiem: string): number {
  let normalized = hour % 12;
  if (meridiem.toUpperCase() === "PM") normalized += 12;
  return normalized * 60 + minute;
}

function hoursFromPeriods(periods: OpeningHours["periods"]): number | null {
  if (!periods?.length) return null;
  let minutes = 0;
  let counted = 0;
  for (const period of periods) {
    if (!period.open?.time || !period.close?.time) continue;
    const open = Number(String(period.open.time).padStart(4, "0").slice(0, 2)) * 60 + Number(String(period.open.time).slice(-2));
    const close = Number(String(period.close.time).padStart(4, "0").slice(0, 2)) * 60 + Number(String(period.close.time).slice(-2));
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    let span = close - open;
    if (span <= 0) span += 24 * 60;
    minutes += span;
    counted += 1;
  }
  if (!counted) return null;
  return Math.round(minutes / 60);
}

function hoursFromWeekdayText(lines: string[] | undefined): number | null {
  if (!lines?.length) return null;
  const pattern = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi;
  let minutes = 0;
  let counted = 0;
  for (const line of lines) {
    if (/closed/i.test(line)) {
      counted += 1;
      continue;
    }
    const matches = line.matchAll(pattern);
    let matched = false;
    for (const match of matches) {
      const start = minutesFromClock(Number(match[1]), Number(match[2] || 0), match[3]);
      const end = minutesFromClock(Number(match[4]), Number(match[5] || 0), match[6]);
      let span = end - start;
      if (span <= 0) span += 24 * 60;
      minutes += span;
      matched = true;
    }
    if (matched) counted += 1;
  }
  if (!counted) return null;
  return Math.round(minutes / 60);
}

export function hoursPerWeekFromOpeningHours(openingHours?: OpeningHours): DataPoint<number | null> {
  const fromPeriods = hoursFromPeriods(openingHours?.periods);
  if (fromPeriods != null) return dataPoint(fromPeriods, "google", 0.9);
  const fromText = hoursFromWeekdayText(openingHours?.weekdayText);
  if (fromText != null) return dataPoint(fromText, "google", 0.84);
  return dataPoint(null, "estimated", 0);
}

export function inputConfidence(competitor: {
  rating?: unknown;
  reviewCount?: unknown;
  distanceMiles?: unknown;
  samplePrices?: { gel?: unknown; pedicure?: unknown; acrylic?: unknown };
} | null | undefined): number {
  const ratingConf = readConfidence(competitor?.rating, GOOGLE_FIELD_CONFIDENCE);
  const reviewConf = readConfidence(competitor?.reviewCount, GOOGLE_FIELD_CONFIDENCE);
  const distanceConf = readConfidence(competitor?.distanceMiles, 0.88);
  const prices = [competitor?.samplePrices?.gel, competitor?.samplePrices?.pedicure, competitor?.samplePrices?.acrylic];
  const priceConf = prices.reduce<number>((sum, field) => sum + readConfidence(field, 0), 0) / prices.length;
  const listing = (ratingConf + reviewConf + distanceConf) / 3;
  return Math.round((listing * 0.6 + priceConf * 0.4) * 100) / 100;
}

export function confidenceWeightedScore(competitor: {
  rating?: unknown;
  reviewCount?: unknown;
  distanceMiles?: unknown;
  samplePrices?: { gel?: unknown; pedicure?: unknown; acrylic?: unknown };
} | null | undefined): number {
  const rating = readPositive(competitor?.rating) ?? 0;
  const reviews = readNumeric(competitor?.reviewCount) ?? 0;
  const distance = Math.max(readPositive(competitor?.distanceMiles) ?? 1, 0.1);
  const base = Math.min(100, Math.round(((rating * Math.log(reviews + 1)) / distance) * 10));
  return Math.round(base * inputConfidence(competitor));
}
