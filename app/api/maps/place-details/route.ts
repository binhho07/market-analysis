import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, AuthenticatedRequest } from "@/lib/middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getPlaceDetails } from "@/lib/google-maps";
import { getCachedPlaceDetails, setCachedPlaceDetails } from "@/lib/google-cache";

const placeDetailsSchema = z.object({
  placeId: z.string().min(1, "Place ID is required"),
});

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      
      // Validate input
      const result = placeDetailsSchema.safeParse(body);
      if (!result.success) {
        return errorResponse(
          "Validation error",
          400,
          "VALIDATION_ERROR",
          result.error.issues
        );
      }

      const { placeId } = result.data;

      // Check cache first
      const cached = await getCachedPlaceDetails(placeId);
      if (cached) {
        return successResponse(
          { ...cached, cached: true },
          "Place details retrieved from cache"
        );
      }

      // Call Google Places Details API
      const details = await getPlaceDetails(placeId);

      if (!details) {
        return errorResponse(
          "Place not found",
          404,
          "PLACE_NOT_FOUND"
        );
      }

      // Cache result
      await setCachedPlaceDetails(placeId, details);

      return successResponse(
        { ...details, cached: false },
        "Place details retrieved successfully"
      );
    } catch (error: any) {
      console.error("Place details API error:", error);
      return errorResponse(
        error.message || "Failed to get place details",
        500,
        "PLACE_DETAILS_ERROR"
      );
    }
  });
}



