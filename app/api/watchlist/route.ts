import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api-response";
import { listWatchTargets, upsertWatchTarget } from "@/lib/monitoring/watch";

const schema = z.object({
  label: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  radiusMiles: z.number().positive(),
  placeId: z.string().optional(),
  watched: z.boolean().optional(),
  monitorArea: z.boolean().optional(),
});

export async function GET() {
  try {
    const watches = await listWatchTargets();
    return successResponse(watches);
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load watchlist", 500, "WATCHLIST_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse("Invalid watch target", 400, "VALIDATION_ERROR");
    }
    const watch = await upsertWatchTarget(parsed.data);
    return successResponse(watch);
  } catch (error: any) {
    return errorResponse(error.message || "Failed to update watchlist", 500, "WATCHLIST_ERROR");
  }
}
