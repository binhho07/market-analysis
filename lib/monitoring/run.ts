import { prisma } from "@/lib/prisma";
import { saveSearchHistory } from "@/lib/search-history";
import { readPositive } from "@/lib/provenance";
import { mapPool } from "@/lib/analysis/pool";
import { diffSnapshots, type MarketEventDraft, type SnapshotRow } from "./diff";

type WatchRecord = {
  id: string;
  label: string;
  latitude: { toString(): string } | number;
  longitude: { toString(): string } | number;
  radiusMiles: { toString(): string } | number;
  placeIds: string[];
  monitorArea: boolean;
};

function asNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serviceNames(competitor: { scrapedServices?: Array<{ name?: string }>; services?: string[] }) {
  if (Array.isArray(competitor.services) && competitor.services.every((item) => typeof item === "string")) {
    return competitor.services.slice(0, 30);
  }
  return (competitor.scrapedServices || [])
    .map((service) => service.name?.trim())
    .filter((name): name is string => Boolean(name))
    .slice(0, 30);
}

function toSnapshotRow(competitor: any): SnapshotRow {
  return {
    placeId: competitor.placeId || competitor.id,
    name: competitor.name,
    reviewCount: competitor.reviewCount ?? null,
    gelPrice: readPositive(competitor.samplePrices?.gel),
    pedicurePrice: readPositive(competitor.samplePrices?.pedicure),
    acrylicPrice: readPositive(competitor.samplePrices?.acrylic),
    distanceMiles: competitor.distanceMiles ?? null,
    services: serviceNames(competitor),
  };
}

function fromStoredSnapshot(snapshot: {
  placeId: string;
  name: string;
  reviewCount: number | null;
  gelPrice: { toString(): string } | number | null;
  pedicurePrice: { toString(): string } | number | null;
  acrylicPrice: { toString(): string } | number | null;
  distanceMiles: { toString(): string } | number | null;
  services?: string[];
}): SnapshotRow {
  return {
    placeId: snapshot.placeId,
    name: snapshot.name,
    reviewCount: snapshot.reviewCount,
    gelPrice: asNumber(snapshot.gelPrice),
    pedicurePrice: asNumber(snapshot.pedicurePrice),
    acrylicPrice: asNumber(snapshot.acrylicPrice),
    distanceMiles: asNumber(snapshot.distanceMiles),
    services: snapshot.services || [],
  };
}

function keepEvent(watch: WatchRecord, event: MarketEventDraft) {
  const areaEvent = event.kind === "new_competitor" || event.kind === "competitor_closed";
  if (areaEvent) return watch.monitorArea || watch.placeIds.length === 0;
  if (!watch.placeIds.length) return true;
  return Boolean(event.placeId && watch.placeIds.includes(event.placeId));
}

async function refreshWatch(watch: WatchRecord, depth: "places" | "prices") {
  const lat = Number(watch.latitude);
  const lng = Number(watch.longitude);
  const radius = Number(watch.radiusMiles) || 5;
  const { searchNearbyPlaces, calculateDistance } = await import("@/lib/google-maps");
  const { getCachedPlaceDetailsBatch } = await import("@/lib/place-cache");

  const places = await searchNearbyPlaces({ lat, lng }, Math.round(radius * 1609.34), "nail salon");
  const details = await getCachedPlaceDetailsBatch(places.map((place) => place.placeId));
  const detailedById = new Map(details.map((place) => [place.placeId, place]));

  const competitors = places.slice(0, 20).map((place) => {
    const detailed = detailedById.get(place.placeId) || place;
    const distance = calculateDistance(lat, lng, detailed.location.lat, detailed.location.lng) || 0.1;
    return {
      id: detailed.placeId,
      placeId: detailed.placeId,
      name: detailed.name,
      address: detailed.address,
      website: detailed.website || "#",
      rating: detailed.rating || 0,
      reviewCount: detailed.userRatingsTotal || 0,
      distanceMiles: Math.round(distance * 10) / 10,
      samplePrices: { gel: null as number | null, pedicure: null as number | null, acrylic: null as number | null },
      scrapedServices: [] as Array<{ name: string; price: number }>,
      services: [] as string[],
      priceSource: "estimated",
    };
  });

  if (depth === "prices") {
    const { smartScrape, estimatePrices } = await import("@/lib/scraping/scraper");
    const watched = watch.placeIds.length
      ? competitors.filter((competitor) => watch.placeIds.includes(competitor.placeId))
      : competitors;
    await mapPool(watched.slice(0, 8), 2, async (competitor) => {
      const estimates = estimatePrices(2);
      competitor.samplePrices = estimates;
      try {
        const scraped = await smartScrape(competitor.name, competitor.website);
        if (scraped.success && scraped.source === "scraped") {
          competitor.samplePrices = {
            gel: scraped.gel || estimates.gel,
            pedicure: scraped.pedicure || estimates.pedicure,
            acrylic: scraped.acrylic || estimates.acrylic,
          };
          competitor.priceSource = "scraped";
          competitor.scrapedServices = scraped.services || [];
        }
      } catch (error) {
        console.warn(`Monitor price scrape failed for ${competitor.name}:`, error);
      }
    });
  }

  const previous = await prisma.searchHistory.findFirst({
    where: {
      latitude: { gte: lat - 0.01, lte: lat + 0.01 },
      longitude: { gte: lng - 0.01, lte: lng + 0.01 },
    },
    orderBy: { searchDate: "desc" },
    include: { snapshots: true },
  });

  if (depth === "places" && previous) {
    const priorById = new Map(previous.snapshots.map((snapshot) => [snapshot.placeId, snapshot]));
    for (const competitor of competitors) {
      const prior = priorById.get(competitor.placeId);
      if (!prior) continue;
      competitor.samplePrices = {
        gel: asNumber(prior.gelPrice),
        pedicure: asNumber(prior.pedicurePrice),
        acrylic: asNumber(prior.acrylicPrice),
      };
      competitor.services = prior.services || [];
    }
  }

  await saveSearchHistory({
    searchAddress: watch.label,
    latitude: lat,
    longitude: lng,
    radiusMiles: radius,
    competitors,
  });

  const drafts = diffSnapshots(
    (previous?.snapshots || []).map(fromStoredSnapshot),
    competitors.map(toSnapshotRow)
  ).filter((event) => keepEvent(watch, event));

  if (drafts.length) {
    await prisma.marketEvent.createMany({
      data: drafts.map((event) => ({
        watchTargetId: watch.id,
        placeId: event.placeId,
        competitorName: event.competitorName,
        kind: event.kind,
        severity: event.severity,
        title: event.title,
        previousValue: event.previousValue,
        nextValue: event.nextValue,
      })),
    });
  }

  await prisma.watchTarget.update({
    where: { id: watch.id },
    data: { lastCrawledAt: new Date() },
  });

  return drafts.length;
}

export async function detectChangesNear(latitude: number, longitude: number) {
  const watch = await prisma.watchTarget.findFirst({
    where: {
      enabled: true,
      latitude: { gte: latitude - 0.01, lte: latitude + 0.01 },
      longitude: { gte: longitude - 0.01, lte: longitude + 0.01 },
    },
  });
  if (!watch) return 0;

  const histories = await prisma.searchHistory.findMany({
    where: {
      latitude: { gte: latitude - 0.01, lte: latitude + 0.01 },
      longitude: { gte: longitude - 0.01, lte: longitude + 0.01 },
    },
    orderBy: { searchDate: "desc" },
    take: 2,
    include: { snapshots: true },
  });
  if (histories.length < 2) return 0;

  const drafts = diffSnapshots(
    histories[1].snapshots.map(fromStoredSnapshot),
    histories[0].snapshots.map(fromStoredSnapshot)
  ).filter((event) => keepEvent(watch, event));

  if (!drafts.length) return 0;
  await prisma.marketEvent.createMany({
    data: drafts.map((event) => ({
      watchTargetId: watch.id,
      placeId: event.placeId,
      competitorName: event.competitorName,
      kind: event.kind,
      severity: event.severity,
      title: event.title,
      previousValue: event.previousValue,
      nextValue: event.nextValue,
    })),
  });
  return drafts.length;
}

export async function monitorWatchlist(depth: "places" | "prices" = "places") {
  const watches = await prisma.watchTarget.findMany({ where: { enabled: true } });
  if (!watches.length) {
    return { watches: 0, events: 0, note: "No watched markets" };
  }

  let events = 0;
  const errors: string[] = [];
  for (const watch of watches) {
    try {
      events += await refreshWatch(watch, depth);
    } catch (error: any) {
      errors.push(`${watch.label}: ${error?.message || "failed"}`);
      console.warn(`Watch crawl failed for ${watch.label}:`, error);
    }
  }

  return { watches: watches.length, events, errors };
}
