import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Get all competitors
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Get total count
    const total = await prisma.competitor.count();

    // Get competitors with pagination
    const competitors = await prisma.competitor.findMany({
      orderBy: { lastCrawled: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        phone: true,
        email: true,
        website: true,
        googleRating: true,
        googleReviewCount: true,
        facebookRating: true,
        facebookReviewCount: true,
        yelpRating: true,
        yelpReviewCount: true,
        facebookUrl: true,
        instagramUrl: true,
        yelpUrl: true,
        lastCrawled: true,
        crawlStatus: true,
        crawlErrors: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        competitors,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("Failed to get competitors:", error);
    return NextResponse.json(
      { error: "Failed to get competitors" },
      { status: 500 }
    );
  }
}









