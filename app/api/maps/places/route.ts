import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuthAndRateLimit, AuthenticatedRequest } from "@/lib/middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { searchNearbyPlaces, calculateDistance } from "@/lib/google-maps";
import { getCachedPlacesSearch, setCachedPlacesSearch } from "@/lib/google-cache";
import { prisma } from "@/lib/prisma";

const placesSearchSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMiles: z.number().min(0.1).max(50),
  keyword: z.string().optional().default("nail salon"),
  limit: z.number().optional().default(20),
});

export async function POST(request: NextRequest) {
  return withAuthAndRateLimit(request, async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      
      // Validate input
      const result = placesSearchSchema.safeParse(body);
      if (!result.success) {
        return errorResponse(
          "Validation error",
          400,
          "VALIDATION_ERROR",
          result.error.issues
        );
      }

      const { lat, lng, radiusMiles, keyword, limit } = result.data;
      const radiusMeters = Math.round(radiusMiles * 1609.34); // Convert miles to meters

      // Check cache first
      const cached = await getCachedPlacesSearch(lat, lng, radiusMeters);
      if (cached) {
        const limited = cached.slice(0, limit);
        return successResponse(
          {
            places: limited,
            cached: true,
            count: limited.length,
          },
          "Places retrieved from cache"
        );
      }

      // Call Google Places API
      const places = await searchNearbyPlaces(
        { lat, lng },
        radiusMeters,
        keyword
      );

      // Calculate distances
      const placesWithDistance = places.map((place) => ({
        ...place,
        distanceMiles: calculateDistance(lat, lng, place.location.lat, place.location.lng),
      }));

      // Sort by distance
      placesWithDistance.sort((a, b) => a.distanceMiles - b.distanceMiles);

      // Cache results
      await setCachedPlacesSearch(lat, lng, radiusMeters, placesWithDistance);

      // Store competitors in database
      for (const place of placesWithDistance.slice(0, limit)) {
        try {
          await prisma.competitor.upsert({
            where: { placeId: place.placeId },
            update: {
              name: place.name,
              address: place.address,
              latitude: place.location.lat,
              longitude: place.location.lng,
              rating: place.rating,
              reviewCount: place.userRatingsTotal,
              priceLevel: place.priceLevel,
              website: place.website,
              phone: place.phoneNumber,
              lastUpdated: new Date(),
            },
            create: {
              placeId: place.placeId,
              name: place.name,
              address: place.address,
              latitude: place.location.lat,
              longitude: place.location.lng,
              rating: place.rating,
              reviewCount: place.userRatingsTotal,
              priceLevel: place.priceLevel,
              website: place.website,
              phone: place.phoneNumber,
            },
          });
        } catch (dbError) {
          console.error("Error storing competitor:", dbError);
          // Continue even if DB fails
        }
      }

      const limited = placesWithDistance.slice(0, limit);
      
      return successResponse(
        {
          places: limited,
          cached: false,
          count: limited.length,
        },
        "Places found successfully"
      );
    } catch (error: any) {
      console.error("Places search API error:", error);
      return errorResponse(
        error.message || "Failed to search places",
        500,
        "PLACES_SEARCH_ERROR"
      );
    }
  });
}



