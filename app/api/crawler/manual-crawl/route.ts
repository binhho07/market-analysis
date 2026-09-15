import { NextRequest, NextResponse } from "next/server";
import { crawlCompetitors } from "@/lib/crawler/competitor-crawler";
import { prisma } from "@/lib/prisma";

/**
 * Manually trigger a competitor crawl for a specific location
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name = "Aventus Nail Spa",
      address = "94 Meadow Park Ave, Lewis Center, OH, United States",
      lat = 40.1584,
      lng = -83.0075,
      radius = 5000, // 5km in meters
      deepCrawl = true,
      takeScreenshots = true,
      includeReviews = true,
      includeSocialMedia = true,
      includeSeoAnalysis = true
    } = body;

    // Validate required fields
    if (!name || !address || !lat || !lng) {
      return NextResponse.json(
        { error: "Missing required fields: name, address, lat, lng" },
        { status: 400 }
      );
    }

    // Create target location object
    const targetLocation = {
      name,
      address,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: parseInt(radius)
    };

    // Create crawl options
    const crawlOptions = {
      deepCrawl: Boolean(deepCrawl),
      takeScreenshots: Boolean(takeScreenshots),
      includeReviews: Boolean(includeReviews),
      includeSocialMedia: Boolean(includeSocialMedia),
      includeSeoAnalysis: Boolean(includeSeoAnalysis)
    };

    console.log(`🚀 Starting manual crawl for ${targetLocation.name}`);
    console.log(`📍 Location: ${targetLocation.address}`);
    console.log(`📏 Radius: ${targetLocation.radius}m`);

    // Start crawl
    const results = await crawlCompetitors(targetLocation, crawlOptions);

    // Log the crawl
    await prisma.crawlLog.create({
      data: {
        crawlType: "manual",
        startTime: new Date(Date.now() - results.totalTime),
        endTime: new Date(),
        status: "completed",
        competitorsFound: results.competitors.length,
        competitorsProcessed: results.processed,
        errorsCount: results.errors,
        notes: `Manual crawl for ${targetLocation.name}`
      }
    });

    return NextResponse.json({
      success: true,
      message: "Manual crawl completed successfully",
      results: {
        competitorsFound: results.competitors.length,
        processed: results.processed,
        errors: results.errors,
        totalTime: results.totalTime,
        competitors: results.competitors.map(comp => ({
          name: comp.name,
          address: comp.address,
          rating: comp.googleRating,
          website: comp.website,
          crawlStatus: comp.crawlStatus
        }))
      }
    });

  } catch (error) {
    console.error("Manual crawl failed:", error);
    
    // Log the failed crawl
    try {
      await prisma.crawlLog.create({
        data: {
          crawlType: "manual",
          startTime: new Date(),
          endTime: new Date(),
          status: "failed",
          competitorsFound: 0,
          competitorsProcessed: 0,
          errorsCount: 1,
          notes: `Manual crawl failed: ${error instanceof Error ? error.message : "Unknown error"}`
        }
      });
    } catch (logError) {
      console.error("Failed to log crawl error:", logError);
    }

    return NextResponse.json(
      { error: "Manual crawl failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}


