import { NextRequest, NextResponse } from "next/server";
import { saveSearchHistory } from "@/lib/search-history";

export async function POST(request: NextRequest) {
  try {
    console.log("📥 [HISTORY SAVE API] Received save request");
    const body = await request.json();
    console.log("📦 [HISTORY SAVE API] Request body:", {
      searchAddress: body.searchAddress,
      latitude: body.latitude,
      longitude: body.longitude,
      radiusMiles: body.radiusMiles,
      competitorCount: body.competitors?.length,
    });
    
    const { searchAddress, latitude, longitude, radiusMiles, competitors } = body;

    if (!searchAddress || !latitude || !longitude || !competitors) {
      console.error("❌ [HISTORY SAVE API] Missing required fields:", {
        hasAddress: !!searchAddress,
        hasLat: !!latitude,
        hasLng: !!longitude,
        hasCompetitors: !!competitors,
      });
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("💾 [HISTORY SAVE API] Saving to database...");
    const historyId = await saveSearchHistory({
      searchAddress,
      latitude,
      longitude,
      radiusMiles: radiusMiles || 10,
      competitors,
    });
    console.log("✅ [HISTORY SAVE API] Saved successfully with ID:", historyId);

    return NextResponse.json({
      success: true,
      data: { historyId },
      message: "Search history saved successfully",
    });
  } catch (error: any) {
    console.error("💥 [HISTORY SAVE API] Error saving search history:", error);
    console.error("Stack trace:", error.stack);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save search history" },
      { status: 500 }
    );
  }
}



