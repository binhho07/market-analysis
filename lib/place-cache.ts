import { prisma } from "@/lib/prisma";
import { PlaceSearchResult, getPlaceDetails } from "@/lib/google-maps";

const CACHE_DURATION_HOURS = 24; // Cache for 24 hours

/**
 * Get cached place details or fetch from Google API if not cached/expired
 * Includes retry logic for sleeping databases (Neon free tier)
 */
export async function getCachedPlaceDetails(placeId: string): Promise<PlaceSearchResult | null> {
  try {
    // Check if we have a valid cached entry (with retry for sleeping DB)
    let cached;
    try {
      cached = await prisma.cachedPlace.findUnique({
        where: { placeId },
      });
    } catch (dbError: any) {
      // If connection is closed, database is waking up - retry once
      if (dbError.message?.includes('Closed') || dbError.message?.includes('connection')) {
        console.log("💤 Database waking up, retrying...");
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        cached = await prisma.cachedPlace.findUnique({
          where: { placeId },
        });
      } else {
        throw dbError;
      }
    }

    const now = new Date();

    // If cache exists and hasn't expired, return it
    if (cached && cached.expiresAt > now) {
      console.log(`✅ Cache HIT for place: ${cached.name}`);
      
      // Update last accessed time and increment access count
      await prisma.cachedPlace.update({
        where: { placeId },
        data: {
          lastAccessed: now,
          accessCount: { increment: 1 },
        },
      }).catch(() => {
        // Ignore errors on access tracking
      });

      // Return in PlaceSearchResult format
      return {
        placeId: cached.placeId,
        name: cached.name,
        website: cached.website || undefined,
        address: cached.address,
        location: {
          lat: Number(cached.latitude),
          lng: Number(cached.longitude),
        },
        rating: cached.rating ? Number(cached.rating) : undefined,
        userRatingsTotal: cached.userRatingsTotal || undefined,
        priceLevel: cached.priceLevel || undefined,
        businessStatus: cached.businessStatus || undefined,
        types: cached.types,
        phoneNumber: cached.phoneNumber || undefined,
      };
    }

    // Cache miss or expired - fetch from Google API
    console.log(`❌ Cache MISS for place ID: ${placeId} - Fetching from Google API...`);
    const placeDetails = await getPlaceDetails(placeId);

    if (!placeDetails) {
      return null;
    }

    // Cache the result (with retry logic)
    const expiresAt = new Date(now.getTime() + CACHE_DURATION_HOURS * 60 * 60 * 1000);
    
    try {
      await prisma.cachedPlace.upsert({
        where: { placeId },
        create: {
        placeId: placeDetails.placeId,
        name: placeDetails.name,
        website: placeDetails.website || null,
        address: placeDetails.address,
        phoneNumber: placeDetails.phoneNumber || null,
        rating: placeDetails.rating ? Number(placeDetails.rating) : null,
        userRatingsTotal: placeDetails.userRatingsTotal || null,
        priceLevel: placeDetails.priceLevel || null,
        latitude: placeDetails.location.lat,
        longitude: placeDetails.location.lng,
        businessStatus: placeDetails.businessStatus || null,
        types: placeDetails.types || [],
        cachedAt: now,
        expiresAt,
        lastAccessed: now,
        accessCount: 1,
      },
      update: {
        name: placeDetails.name,
        website: placeDetails.website || null,
        address: placeDetails.address,
        phoneNumber: placeDetails.phoneNumber || null,
        rating: placeDetails.rating ? Number(placeDetails.rating) : null,
        userRatingsTotal: placeDetails.userRatingsTotal || null,
        priceLevel: placeDetails.priceLevel || null,
        latitude: placeDetails.location.lat,
        longitude: placeDetails.location.lng,
        businessStatus: placeDetails.businessStatus || null,
        types: placeDetails.types || [],
        cachedAt: now,
        expiresAt,
        lastAccessed: now,
        accessCount: 1,
      },
      });
      console.log(`💾 Cached place: ${placeDetails.name} (expires in ${CACHE_DURATION_HOURS}h)`);
    } catch (cacheError: any) {
      // If caching fails (DB sleeping), continue without caching
      console.warn(`⚠️ Failed to cache place (DB may be sleeping): ${cacheError.message}`);
    }

    return placeDetails;
  } catch (error) {
    console.error(`Error getting cached place details for ${placeId}:`, error);
    // Fallback to direct API call if cache fails
    try {
      return await getPlaceDetails(placeId);
    } catch (apiError) {
      console.error(`Failed to fetch place details from API:`, apiError);
      return null;
    }
  }
}

/**
 * Batch fetch place details with caching
 */
export async function getCachedPlaceDetailsBatch(placeIds: string[]): Promise<PlaceSearchResult[]> {
  const results = await Promise.all(
    placeIds.map((placeId) => getCachedPlaceDetails(placeId))
  );

  return results.filter((place): place is PlaceSearchResult => place !== null);
}

/**
 * Clean up expired cache entries (run periodically)
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const result = await prisma.cachedPlace.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    console.log(`🧹 Cleaned up ${result.count} expired cache entries`);
    return result.count;
  } catch (error) {
    console.error("Failed to clean up expired cache:", error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const total = await prisma.cachedPlace.count();
    const expired = await prisma.cachedPlace.count({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const topPlaces = await prisma.cachedPlace.findMany({
      take: 10,
      orderBy: { accessCount: 'desc' },
      select: {
        name: true,
        accessCount: true,
        cachedAt: true,
        expiresAt: true,
      },
    });

    return {
      total,
      active: total - expired,
      expired,
      topPlaces,
    };
  } catch (error) {
    console.error("Failed to get cache stats:", error);
    return null;
  }
}

