import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api-response";
import { enqueueAnalysisJob, toPublicJob } from "@/lib/queue/analysis-queue";
import { geocodeAddress } from "@/lib/google-maps";

const schema = z.object({
  address: z.string().min(5).max(200),
  radius: z.number().min(1).max(50),
  competitorCount: z.number().min(1).max(50),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse("Validation error", 400, "VALIDATION_ERROR", parsed.error.issues);
    }

    let { address, radius, competitorCount, lat, lng } = parsed.data;

    if (typeof lat !== "number" || typeof lng !== "number") {
      const geocoded = await geocodeAddress(address);
      if (!geocoded) {
        return errorResponse("Address not found", 404, "ADDRESS_NOT_FOUND");
      }
      lat = geocoded.lat;
      lng = geocoded.lng;
    }

    const job = await enqueueAnalysisJob({
      address,
      lat,
      lng,
      radius,
      competitorCount,
    });

    return successResponse(
      {
        jobId: job.id,
        ...toPublicJob(job),
      },
      "Analysis job queued",
      202
    );
  } catch (error: any) {
    console.error("Failed to queue analysis:", error);
    return errorResponse(error.message || "Failed to queue analysis", 500, "QUEUE_ERROR");
  }
}
