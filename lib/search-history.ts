import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface HistoricalData {
  date: Date;
  avgRating: number;
  avgGelPrice: number;
  avgPedicurePrice: number;
  avgAcrylicPrice: number;
  competitorCount: number;
}

export interface CompetitorTrend {
  placeId: string;
  name: string;
  snapshots: {
    date: Date;
    rating?: number;
    reviewCount?: number;
    gelPrice?: number;
    pedicurePrice?: number;
    acrylicPrice?: number;
    competitiveScore?: number;
  }[];
  changes: {
    ratingChange?: number;
    reviewGrowth?: number;
    priceChanges?: {
      gel?: number;
      pedicure?: number;
      acrylic?: number;
    };
  };
}

/**
 * Save search results to historical tracking
 */
export async function saveSearchHistory(params: {
  searchAddress: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  competitors: any[];
}): Promise<string> {
  console.log("🗂️ [saveSearchHistory] Starting to save search history");
  const { searchAddress, latitude, longitude, radiusMiles, competitors } = params;

  console.log("🗂️ [saveSearchHistory] Parameters:", {
    searchAddress,
    latitude,
    longitude,
    radiusMiles,
    competitorCount: competitors.length,
  });

  // Calculate aggregated metrics
  const avgRating = competitors.reduce((sum, c) => sum + (c.rating || 0), 0) / competitors.length;
  const avgGelPrice = competitors.reduce((sum, c) => sum + (c.samplePrices?.gel || 0), 0) / competitors.length;
  const avgPedicurePrice = competitors.reduce((sum, c) => sum + (c.samplePrices?.pedicure || 0), 0) / competitors.length;
  const avgAcrylicPrice = competitors.reduce((sum, c) => sum + (c.samplePrices?.acrylic || 0), 0) / competitors.length;

  console.log("📊 [saveSearchHistory] Calculated metrics:", {
    avgRating,
    avgGelPrice,
    avgPedicurePrice,
    avgAcrylicPrice,
  });

  // Create search history record with snapshots
  console.log("💾 [saveSearchHistory] Creating database record...");
  const searchHistory = await prisma.searchHistory.create({
    data: {
      searchAddress,
      latitude,
      longitude,
      radiusMiles,
      competitorCount: competitors.length,
      avgRating,
      avgGelPrice,
      avgPedicurePrice,
      avgAcrylicPrice,
      snapshots: {
        create: competitors.map((c) => ({
          placeId: c.placeId || c.id || `place-${c.name}`,
          name: c.name,
          address: c.address,
          rating: c.rating,
          reviewCount: c.reviewCount,
          priceRange: c.priceRange,
          gelPrice: c.samplePrices?.gel,
          pedicurePrice: c.samplePrices?.pedicure,
          acrylicPrice: c.samplePrices?.acrylic,
          distanceMiles: c.distanceMiles,
          competitiveScore: c.competitiveScore,
        })),
      },
    },
  });

  console.log("✅ [saveSearchHistory] Saved successfully, ID:", searchHistory.id);
  return searchHistory.id;
}

/**
 * Get historical data for a location
 */
export async function getSearchHistory(params: {
  searchAddress: string;
  limit?: number;
}): Promise<HistoricalData[]> {
  const { searchAddress, limit = 30 } = params;

  const history = await prisma.searchHistory.findMany({
    where: {
      searchAddress: {
        contains: searchAddress,
        mode: "insensitive",
      },
    },
    orderBy: {
      searchDate: "desc",
    },
    take: limit,
    select: {
      searchDate: true,
      avgRating: true,
      avgGelPrice: true,
      avgPedicurePrice: true,
      avgAcrylicPrice: true,
      competitorCount: true,
    },
  });

  return history.map((h) => ({
    date: h.searchDate,
    avgRating: Number(h.avgRating || 0),
    avgGelPrice: Number(h.avgGelPrice || 0),
    avgPedicurePrice: Number(h.avgPedicurePrice || 0),
    avgAcrylicPrice: Number(h.avgAcrylicPrice || 0),
    competitorCount: h.competitorCount,
  }));
}

/**
 * Get competitor trends over time
 */
export async function getCompetitorTrends(params: {
  searchAddress: string;
  limit?: number;
}): Promise<CompetitorTrend[]> {
  const { searchAddress, limit = 10 } = params;

  // Get recent search histories for this location
  const histories = await prisma.searchHistory.findMany({
    where: {
      searchAddress: {
        contains: searchAddress,
        mode: "insensitive",
      },
    },
    orderBy: {
      searchDate: "desc",
    },
    take: 10, // Last 10 searches
    include: {
      snapshots: true,
    },
  });

  if (histories.length === 0) return [];

  // Group snapshots by placeId
  const competitorMap = new Map<string, any>();

  histories.forEach((history) => {
    history.snapshots.forEach((snapshot) => {
      if (!competitorMap.has(snapshot.placeId)) {
        competitorMap.set(snapshot.placeId, {
          placeId: snapshot.placeId,
          name: snapshot.name,
          snapshots: [],
        });
      }

      competitorMap.get(snapshot.placeId).snapshots.push({
        date: snapshot.snapshotDate,
        rating: Number(snapshot.rating || 0),
        reviewCount: snapshot.reviewCount,
        gelPrice: Number(snapshot.gelPrice || 0),
        pedicurePrice: Number(snapshot.pedicurePrice || 0),
        acrylicPrice: Number(snapshot.acrylicPrice || 0),
        competitiveScore: snapshot.competitiveScore,
      });
    });
  });

  // Calculate changes for each competitor
  const trends: CompetitorTrend[] = Array.from(competitorMap.values()).map((comp) => {
    const snapshots = comp.snapshots.sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const oldest = snapshots[0];
    const newest = snapshots[snapshots.length - 1];

    return {
      placeId: comp.placeId,
      name: comp.name,
      snapshots,
      changes: {
        ratingChange: newest.rating - oldest.rating,
        reviewGrowth: newest.reviewCount - oldest.reviewCount,
        priceChanges: {
          gel: newest.gelPrice - oldest.gelPrice,
          pedicure: newest.pedicurePrice - oldest.pedicurePrice,
          acrylic: newest.acrylicPrice - oldest.acrylicPrice,
        },
      },
    };
  });

  // Sort by competitive score (highest first)
  return trends
    .filter((t) => t.snapshots.length > 1) // Only show competitors with multiple data points
    .sort((a, b) => {
      const aScore = a.snapshots[a.snapshots.length - 1].competitiveScore || 0;
      const bScore = b.snapshots[b.snapshots.length - 1].competitiveScore || 0;
      return bScore - aScore;
    })
    .slice(0, limit);
}

/**
 * Detect significant changes and generate alerts
 */
export async function detectMarketChanges(params: {
  searchAddress: string;
}): Promise<{
  newCompetitors: string[];
  priceChanges: Array<{ name: string; service: string; oldPrice: number; newPrice: number }>;
  ratingChanges: Array<{ name: string; oldRating: number; newRating: number }>;
}> {
  const { searchAddress } = params;

  const histories = await prisma.searchHistory.findMany({
    where: {
      searchAddress: {
        contains: searchAddress,
        mode: "insensitive",
      },
    },
    orderBy: {
      searchDate: "desc",
    },
    take: 2, // Compare last 2 searches
    include: {
      snapshots: true,
    },
  });

  if (histories.length < 2) {
    return { newCompetitors: [], priceChanges: [], ratingChanges: [] };
  }

  const [latest, previous] = histories;
  const latestPlaceIds = new Set(latest.snapshots.map((s) => s.placeId));
  const previousPlaceIds = new Set(previous.snapshots.map((s) => s.placeId));

  // Detect new competitors
  const newCompetitors = latest.snapshots
    .filter((s) => !previousPlaceIds.has(s.placeId))
    .map((s) => s.name);

  // Detect significant price changes (>10%)
  const priceChanges: any[] = [];
  const ratingChanges: any[] = [];

  latest.snapshots.forEach((latestSnap) => {
    const prevSnap = previous.snapshots.find((s) => s.placeId === latestSnap.placeId);
    if (!prevSnap) return;

    // Check rating changes
    const ratingDiff = Number(latestSnap.rating || 0) - Number(prevSnap.rating || 0);
    if (Math.abs(ratingDiff) >= 0.3) {
      ratingChanges.push({
        name: latestSnap.name,
        oldRating: Number(prevSnap.rating || 0),
        newRating: Number(latestSnap.rating || 0),
      });
    }

    // Check price changes
    const checkPriceChange = (service: string, latestPrice: any, prevPrice: any) => {
      if (!latestPrice || !prevPrice) return;
      const latest = Number(latestPrice);
      const prev = Number(prevPrice);
      const percentChange = Math.abs((latest - prev) / prev);
      
      if (percentChange >= 0.1) { // 10% change
        priceChanges.push({
          name: latestSnap.name,
          service,
          oldPrice: prev,
          newPrice: latest,
        });
      }
    };

    checkPriceChange("Gel Manicure", latestSnap.gelPrice, prevSnap.gelPrice);
    checkPriceChange("Pedicure", latestSnap.pedicurePrice, prevSnap.pedicurePrice);
    checkPriceChange("Acrylic", latestSnap.acrylicPrice, prevSnap.acrylicPrice);
  });

  return {
    newCompetitors,
    priceChanges,
    ratingChanges,
  };
}



