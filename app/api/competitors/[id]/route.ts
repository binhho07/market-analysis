import { NextRequest } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (_req: AuthenticatedRequest) => {
    try {
      const { id } = params;

      const competitor = await prisma.competitor.findUnique({
        where: { id },
        include: {
          services: true,
          amenities: true,
        },
      });

      if (!competitor) {
        return notFoundResponse("Competitor not found");
      }

      return successResponse(competitor, "Competitor retrieved successfully");
    } catch (error) {
      console.error("Get competitor error:", error);
      return errorResponse(
        "Failed to retrieve competitor",
        500,
        "INTERNAL_ERROR"
      );
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (_req: AuthenticatedRequest) => {
    try {
      const { id } = params;

      await prisma.competitor.delete({
        where: { id },
      });

      return successResponse(null, "Competitor deleted successfully");
    } catch (error) {
      console.error("Delete competitor error:", error);
      return errorResponse(
        "Failed to delete competitor",
        500,
        "INTERNAL_ERROR"
      );
    }
  });
}



