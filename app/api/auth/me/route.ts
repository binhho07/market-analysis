import { NextRequest } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/middleware";
import { successResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    return successResponse(req.user, "User retrieved successfully");
  });
}



