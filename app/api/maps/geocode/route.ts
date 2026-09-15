import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api-response";
import { geocodeAddress } from "@/lib/google-maps";
import { getCachedGeocoding, setCachedGeocoding } from "@/lib/google-cache";

const geocodeSchema = z.object({
  address: z.string().min(3, "Address must be at least 3 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = geocodeSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(
        "Validation error",
        400,
        "VALIDATION_ERROR",
        result.error.issues
      );
    }

    const { address } = result.data;

    // Check cache first
    const cached = await getCachedGeocoding(address);
    if (cached) {
      return successResponse(
        { ...cached, cached: true },
        "Geocoding result retrieved from cache"
      );
    }

    // Call Google Maps API
    const geocodingResult = await geocodeAddress(address);

    if (!geocodingResult) {
      return errorResponse(
        "Address not found or invalid",
        404,
        "ADDRESS_NOT_FOUND"
      );
    }

    // Cache result
    await setCachedGeocoding(address, geocodingResult);

    return successResponse(
      { ...geocodingResult, cached: false },
      "Address geocoded successfully"
    );
  } catch (error: any) {
    console.error("Geocoding API error:", error);
    return errorResponse(
      error.message || "Failed to geocode address",
      500,
      "GEOCODING_ERROR"
    );
  }
}



