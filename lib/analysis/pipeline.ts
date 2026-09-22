import { prisma } from "@/lib/prisma";
import { saveSearchHistory } from "@/lib/search-history";
import { buildMarketSnapshot } from "@/lib/js/marketSnapshot.js";
import { emptyProgress, type AnalysisJobPayload } from "./types";
import { markStage, setJobProgress } from "./progress";
import { mapPool } from "./pool";
import { buildEvidencePack } from "./evidence";
import { writeGroundedReport } from "./llm-report";
import {
  ASSUMED_TIER_CONFIDENCE,
  TIER_ESTIMATE_CONFIDENCE,
  WEBSITE_PRICE_CONFIDENCE,
  confidenceWeightedScore,
  hoursPerWeekFromOpeningHours,
  pricePoint,
  staffBandFromReviews,
  dataPoint,
} from "@/lib/provenance";

export async function processAnalysisJob(payload: AnalysisJobPayload) {
  const { jobId, address, lat, lng, radius, competitorCount } = payload;
  let progress = emptyProgress();

  const existing = await prisma.analysisJob.findUnique({ where: { id: jobId } });
  if (!existing) return;
  if (existing.status === "completed") return;

  await prisma.analysisJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      attempts: { increment: 1 },
      startedAt: existing.startedAt ?? new Date(),
      error: null,
    },
  });

  try {
    progress = markStage(progress, "places", "running", 0, competitorCount);
    await setJobProgress(jobId, "places", progress);

    const { searchNearbyPlaces, calculateDistance } = await import("@/lib/google-maps");
    const { getCachedPlaceDetailsBatch } = await import("@/lib/place-cache");

    const radiusMeters = Math.round(radius * 1609.34);
    const places = await searchNearbyPlaces({ lat, lng }, radiusMeters, "nail salon");
    const detailedPlaces = await getCachedPlaceDetailsBatch(places.map((place) => place.placeId));
    const detailedById = new Map(detailedPlaces.map((place) => [place.placeId, place]));
    const mergedPlaces = places.map((place) => detailedById.get(place.placeId) || place);

    const competitors = mergedPlaces
      .map((place) => {
        const priceLevelKnown = place.priceLevel != null;
        const priceLevel = place.priceLevel || 2;
        const priceRange = !priceLevelKnown
          ? "unknown"
          : priceLevel === 1
            ? "$"
            : priceLevel === 2
              ? "$$"
              : priceLevel === 3
                ? "$$$"
                : "$$$$";
        const distance = calculateDistance(lat, lng, place.location.lat, place.location.lng) || 0.1;
        const estimateConfidence = priceLevelKnown ? TIER_ESTIMATE_CONFIDENCE : ASSUMED_TIER_CONFIDENCE;

        const competitor = {
          id: place.placeId,
          placeId: place.placeId,
          name: place.name,
          website: place.website || "#",
          address: place.address,
          phone: place.phoneNumber,
          location: place.location,
          rating: place.rating || 0,
          reviewCount: place.userRatingsTotal || 0,
          priceRange,
          priceLevelKnown,
          estimateConfidence,
          distanceMiles: distance,
          samplePrices: {
            gel: pricePoint(null, "estimated", 0),
            pedicure: pricePoint(null, "estimated", 0),
            acrylic: pricePoint(null, "estimated", 0),
          },
          staffBand: staffBandFromReviews(place.userRatingsTotal || 0),
          hoursPerWeek: hoursPerWeekFromOpeningHours(place.openingHours),
          amenities: dataPoint<string[]>([], "estimated", 0),
          competitiveScore: 0,
          discoveredWebsite: false,
          websiteConfidence: "low" as string,
          websiteScore: 0,
          servicesPage: undefined as string | undefined,
          menuPage: undefined as string | undefined,
          priceSource: "estimated",
          scrapedServices: [] as Array<{ name: string; price: number }>,
        };
        competitor.competitiveScore = confidenceWeightedScore(competitor);
        return competitor;
      })
      .sort((a, b) =>
        Math.abs(a.competitiveScore - b.competitiveScore) > 1
          ? b.competitiveScore - a.competitiveScore
          : a.distanceMiles - b.distanceMiles
      )
      .slice(0, competitorCount);

    progress = markStage(progress, "places", "done", competitors.length, competitors.length);
    progress = markStage(progress, "websites", "running", 0, competitors.length);
    await setJobProgress(jobId, "websites", progress);

    const { isBlacklistedDomain } = await import("@/lib/search/domainClassifier");
    const { discoverWebsite } = await import("@/lib/search/websiteDiscovery");

    const needsDiscovery = competitors.filter(
      (comp) => !comp.website || comp.website === "#" || isBlacklistedDomain(comp.website)
    );

    let discoveredCount = competitors.length - needsDiscovery.length;
    progress = markStage(progress, "websites", "running", discoveredCount, competitors.length);
    await setJobProgress(jobId, "websites", progress);

    await mapPool(needsDiscovery, 2, async (comp) => {
      try {
        const discovered = await discoverWebsite(comp.name, comp.address, comp.phone);
        if (discovered.success && discovered.homepage) {
          comp.website = discovered.homepage;
          comp.discoveredWebsite = true;
          comp.websiteConfidence = discovered.confidence;
          comp.websiteScore = discovered.score;
          comp.servicesPage = discovered.servicesPage;
          comp.menuPage = discovered.menuPage;
        }
      } catch (error) {
        console.warn(`Website discovery failed for ${comp.name}:`, error);
      } finally {
        discoveredCount += 1;
        progress = markStage(progress, "websites", "running", discoveredCount, competitors.length);
        await setJobProgress(jobId, "websites", progress);
      }
    });

    progress = markStage(progress, "websites", "done", competitors.length, competitors.length);
    progress = markStage(progress, "prices", "running", 0, competitors.length);
    await setJobProgress(jobId, "prices", progress);

    const { smartScrape, estimatePrices } = await import("@/lib/scraping/scraper");
    let pricedCount = 0;

    await mapPool(competitors, 3, async (comp) => {
      const priceLevelMap: Record<string, number> = { $: 1, $$: 2, $$$: 3, $$$$: 4 };
      const estimates = estimatePrices(priceLevelMap[comp.priceRange] || 2);
      const tierConfidence = comp.estimateConfidence;
      let gel = pricePoint(estimates.gel, "estimated", tierConfidence);
      let pedicure = pricePoint(estimates.pedicure, "estimated", tierConfidence);
      let acrylic = pricePoint(estimates.acrylic, "estimated", tierConfidence);
      let source = "estimated";

      try {
        const scrapeUrl = comp.servicesPage || comp.menuPage || comp.website;
        const scraped = await smartScrape(comp.name, scrapeUrl, comp.websiteScore);
        if (scraped.success && scraped.source === "scraped") {
          if (scraped.gel) gel = pricePoint(scraped.gel, "website", WEBSITE_PRICE_CONFIDENCE, scrapeUrl);
          if (scraped.pedicure) pedicure = pricePoint(scraped.pedicure, "website", WEBSITE_PRICE_CONFIDENCE, scrapeUrl);
          if (scraped.acrylic) acrylic = pricePoint(scraped.acrylic, "website", WEBSITE_PRICE_CONFIDENCE, scrapeUrl);
          if (gel.source === "website" || pedicure.source === "website" || acrylic.source === "website") {
            source = "scraped";
          }
          if (scraped.services?.length) {
            comp.scrapedServices = scraped.services.slice(0, 10);
          }
        }
      } catch (error) {
        console.warn(`Price scrape failed for ${comp.name}:`, error);
      }

      comp.samplePrices = { gel, pedicure, acrylic };
      comp.priceSource = source;
      comp.competitiveScore = confidenceWeightedScore(comp);
      pricedCount += 1;
      progress = markStage(progress, "prices", "running", pricedCount, competitors.length);
      await setJobProgress(jobId, "prices", progress);
    });

    competitors.sort((a, b) =>
      Math.abs(a.competitiveScore - b.competitiveScore) > 1
        ? b.competitiveScore - a.competitiveScore
        : a.distanceMiles - b.distanceMiles
    );

    progress = markStage(progress, "prices", "done", competitors.length, competitors.length);
    progress = markStage(progress, "insights", "running", 0, 1);
    await setJobProgress(jobId, "insights", progress);

    const snapshot = buildMarketSnapshot(competitors);
    const evidence = buildEvidencePack(competitors, {
      address,
      lat,
      lng,
      radiusMiles: radius,
    });
    const report = await writeGroundedReport(evidence);
    const insights = { snapshot, evidence, report };
    try {
      await saveSearchHistory({
        searchAddress: address,
        latitude: lat,
        longitude: lng,
        radiusMiles: radius,
        competitors,
      });
    } catch (error) {
      console.warn("Failed to persist search history:", error);
    }

    progress = markStage(progress, "insights", "done", 1, 1);
    await setJobProgress(jobId, "done", progress, {
      status: "completed",
      error: null,
      result: {
        competitors: JSON.parse(JSON.stringify(competitors)),
        searchLocation: { lat, lng },
        insights,
        meta: {
          searchAddress: address,
          radius,
          count: competitors.length,
        },
      },
    });
  } catch (error: any) {
    await setJobProgress(jobId, "places", progress, {
      status: "failed",
      error: error?.message || "Analysis failed",
    });
    throw error;
  }
}
