import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    console.log("📥 [HISTORY GET API] Received get request");
    const body = await request.json();
    const { limit = 10, latitude, longitude } = body;
    console.log("📦 [HISTORY GET API] Query params:", { limit, latitude, longitude });

    // Build query
    const where: any = {};
    
    // If latitude and longitude provided, search nearby
    if (latitude && longitude) {
      // Search within a reasonable distance (e.g., 50 miles)
      const latRange = 0.725; // ~50 miles in latitude degrees
      const lngRange = 0.725; // ~50 miles in longitude degrees
      
      where.latitude = {
        gte: latitude - latRange,
        lte: latitude + latRange,
      };
      where.longitude = {
        gte: longitude - lngRange,
        lte: longitude + lngRange,
      };
      console.log("🔍 [HISTORY GET API] Searching nearby:", { latRange, lngRange });
    } else {
      console.log("🌍 [HISTORY GET API] Searching all locations");
    }

    // Fetch search history with snapshots
    console.log("💾 [HISTORY GET API] Querying database...");
    console.log("💾 [HISTORY GET API] Where clause:", JSON.stringify(where, null, 2));
    
    let history;
    try {
      history = await prisma.searchHistory.findMany({
        where,
        include: {
          snapshots: true,
        },
        orderBy: {
          searchDate: "desc",
        },
        take: limit,
      });
      console.log("✅ [HISTORY GET API] Found", history.length, "records");
    } catch (queryError: any) {
      console.error("💥 [HISTORY GET API] Query error:", queryError.message);
      throw queryError;
    }
    
    // Ensure history is always an array
    const historyData = Array.isArray(history) ? history : [];
    
    return successResponse({ data: historyData }, "Search history retrieved successfully");
  } catch (error: any) {
    console.error("💥 [HISTORY GET API] Error fetching search history:", error);
    console.error("Stack:", error.stack);
    return errorResponse("Failed to fetch search history", 500);
  }
}
