import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-response";
import { monitorWatchlist } from "@/lib/monitoring/run";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const depth = body.depth === "prices" ? "prices" : "places";
    const result = await monitorWatchlist(depth);
    return successResponse(result);
  } catch (error: any) {
    return errorResponse(error.message || "Monitor run failed", 500, "MONITOR_ERROR");
  }
}
