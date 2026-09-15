import { NextRequest } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/middleware";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const { id } = params;

      // Check if search belongs to user
      const search = await prisma.savedSearch.findUnique({
        where: { id },
      });

      if (!search) {
        return notFoundResponse("Saved search not found");
      }

      if (search.userId !== req.user!.id) {
        return errorResponse(
          "You do not have permission to delete this search",
          403,
          "FORBIDDEN"
        );
      }

      await prisma.savedSearch.delete({
        where: { id },
      });

      return successResponse(null, "Saved search deleted successfully");
    } catch (error) {
      console.error("Delete search error:", error);
      return errorResponse(
        "Failed to delete saved search",
        500,
        "INTERNAL_ERROR"
      );
    }
  });
}



