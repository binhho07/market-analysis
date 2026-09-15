 import { NextRequest, NextResponse } from "next/server";
import { cronManager } from "@/lib/crawler/cron-manager";

/**
 * Start automated competitor crawling
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crawlType = "daily" } = body;

    // Validate crawl type
    if (!["daily", "weekly", "hourly"].includes(crawlType)) {
      return NextResponse.json(
        { error: "Invalid crawl type. Must be daily, weekly, or hourly." },
        { status: 400 }
      );
    }

    // Start the cron manager if not already running
    if (!cronManager.getStatus()["daily-crawl"]) {
      cronManager.startAll();
    }

    // Trigger manual crawl
    await cronManager.triggerManualCrawl(crawlType as "daily" | "weekly" | "hourly");

    return NextResponse.json({
      success: true,
      message: `${crawlType} crawl started successfully`,
      status: cronManager.getStatus()
    });

  } catch (error) {
    console.error("Failed to start crawler:", error);
    return NextResponse.json(
      { error: "Failed to start crawler" },
      { status: 500 }
    );
  }
}

/**
 * Get crawler status
 */
export async function GET() {
  try {
    const status = cronManager.getStatus();
    
    return NextResponse.json({
      success: true,
      status,
      message: "Crawler status retrieved successfully"
    });

  } catch (error) {
    console.error("Failed to get crawler status:", error);
    return NextResponse.json(
      { error: "Failed to get crawler status" },
      { status: 500 }
    );
  }
}

