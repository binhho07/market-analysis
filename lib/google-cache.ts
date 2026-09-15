import { Redis } from "ioredis";
import { GeocodingResult, PlaceSearchResult } from "./google-maps";

let redis: Redis | null = null;

try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on('error', (err) => {
      console.warn('Redis connection error:', err.message);
      redis = null;
    });
  }
} catch (error) {
  console.warn('Redis initialization failed:', error);
  redis = null;
}

const CACHE_TTL = {
  GEOCODING: 60 * 60 * 24 * 7, // 7 days
  PLACES_SEARCH: 60 * 60 * 24, // 24 hours
  PLACE_DETAILS: 60 * 60 * 12, // 12 hours
};

/**
 * Cache geocoding results
 */
export async function getCachedGeocoding(address: string): Promise<GeocodingResult | null> {
  if (!redis) return null;
  
  try {
    const key = `geocode:${address.toLowerCase().trim()}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

export async function setCachedGeocoding(
  address: string,
  result: GeocodingResult
): Promise<void> {
  if (!redis) return;
  
  try {
    const key = `geocode:${address.toLowerCase().trim()}`;
    await redis.setex(key, CACHE_TTL.GEOCODING, JSON.stringify(result));
  } catch (error) {
    console.error("Redis set error:", error);
  }
}

/**
 * Cache places search results
 */
export async function getCachedPlacesSearch(
  lat: number,
  lng: number,
  radius: number
): Promise<PlaceSearchResult[] | null> {
  if (!redis) return null;
  
  try {
    const key = `places:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

export async function setCachedPlacesSearch(
  lat: number,
  lng: number,
  radius: number,
  results: PlaceSearchResult[]
): Promise<void> {
  if (!redis) return;
  
  try {
    const key = `places:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}`;
    await redis.setex(key, CACHE_TTL.PLACES_SEARCH, JSON.stringify(results));
  } catch (error) {
    console.error("Redis set error:", error);
  }
}

/**
 * Cache place details
 */
export async function getCachedPlaceDetails(placeId: string): Promise<PlaceSearchResult | null> {
  if (!redis) return null;
  
  try {
    const key = `place_details:${placeId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

export async function setCachedPlaceDetails(
  placeId: string,
  details: PlaceSearchResult
): Promise<void> {
  if (!redis) return;
  
  try {
    const key = `place_details:${placeId}`;
    await redis.setex(key, CACHE_TTL.PLACE_DETAILS, JSON.stringify(details));
  } catch (error) {
    console.error("Redis set error:", error);
  }
}



