import { NextRequest } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/middleware";
import { successResponse, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET - List all saved searches for user
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const skip = (page - 1) * limit;

      const [searches, total] = await Promise.all([
        prisma.savedSearch.findMany({
          where: { userId: req.user!.id },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.savedSearch.count({
          where: { userId: req.user!.id },
        }),
      ]);

      return successResponse({
        searches,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }, "Saved searches retrieved successfully");
    } catch (error) {
      console.error("Get searches error:", error);
      return errorResponse(
        "Failed to retrieve saved searches",
        500,
        "INTERNAL_ERROR"
      );
    }
  });
}

// POST - Save a new search
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      const { searchAddress, radiusMiles, competitorCount, results } = body;

      const search = await prisma.savedSearch.create({
        data: {
          userId: req.user!.id,
          searchAddress,
          radiusMiles,
          competitorCount,
          results,
        },
      });

      return successResponse(search, "Search saved successfully", 201);
    } catch (error) {
      console.error("Save search error:", error);
      return errorResponse(
        "Failed to save search",
        500,
        "INTERNAL_ERROR"
      );
    }
  });
}



