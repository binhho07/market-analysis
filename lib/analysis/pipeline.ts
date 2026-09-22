import { prisma } from "@/lib/prisma";
import { saveSearchHistory } from "@/lib/search-history";
import { buildMarketSnapshot } from "@/lib/js/marketSnapshot.js";
import { emptyProgress, type AnalysisJobPayload } from "./types";
import { markStage, setJobProgress } from "./progress";
import { mapPool } from "./pool";
import { buildEvidencePack } from "./evidence";
import { writeGroundedReport } from "./llm-report";

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
        const priceLevel = place.priceLevel || 2;
        const priceRange =
          priceLevel === 1 ? "$" : priceLevel === 2 ? "$$" : priceLevel === 3 ? "$$$" : "$$$$";
        const rating = place.rating || 3;
        const reviews = place.userRatingsTotal || 1;
        const distance = calculateDistance(lat, lng, place.location.lat, place.location.lng) || 0.1;
        const score = ((rating / 5) * 10) * (Math.log(reviews + 1) * 2) * ((1 / Math.max(distance, 0.1)) * 0.5);

        return {
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
          distanceMiles: distance,
          samplePrices: { gel: null as number | null, pedicure: null as number | null, acrylic: null as number | null },
          staffBand: (place.userRatingsTotal || 0) > 200 ? "8+" : (place.userRatingsTotal || 0) > 100 ? "4-7" : "1-3",
          hoursPerWeek: 50 + Math.floor(Math.random() * 30),
          amenities: ["Wi-Fi", "Wheelchair Accessible", "Parking"].slice(0, Math.floor(Math.random() * 3) + 1),
          competitiveScore: Math.round(score * 10) / 10,
          discoveredWebsite: false,
          websiteConfidence: "low" as string,
          websiteScore: 0,
          servicesPage: undefined as string | undefined,
          menuPage: undefined as string | undefined,
          priceSource: "estimated",
          scrapedServices: [] as Array<{ name: string; price: number }>,
        };
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
      let gel = estimates.gel;
      let pedicure = estimates.pedicure;
      let acrylic = estimates.acrylic;
      let source = "estimated";

      try {
        const scrapeUrl = comp.servicesPage || comp.menuPage || comp.website;
        const scraped = await smartScrape(comp.name, scrapeUrl, comp.websiteScore);
        if (scraped.success && scraped.source === "scraped") {
          gel = scraped.gel || gel;
          pedicure = scraped.pedicure || pedicure;
          acrylic = scraped.acrylic || acrylic;
          source = "scraped";
          if (scraped.services?.length) {
            comp.scrapedServices = scraped.services.slice(0, 10);
          }
        }
      } catch (error) {
        console.warn(`Price scrape failed for ${comp.name}:`, error);
      }

      comp.samplePrices = { gel, pedicure, acrylic };
      comp.priceSource = source;
      pricedCount += 1;
      progress = markStage(progress, "prices", "running", pricedCount, competitors.length);
      await setJobProgress(jobId, "prices", progress);
    });

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
