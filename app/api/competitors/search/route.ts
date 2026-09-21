import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api-response";
import { enqueueAnalysisJob, toPublicJob } from "@/lib/queue/analysis-queue";

const searchSchema = z.object({
  address: z.string().min(5, "Address must be at least 5 characters"),
  radius: z.number().min(1).max(50),
  competitorCount: z.number().min(1).max(50),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const result = searchSchema.safeParse(await request.json());
    if (!result.success) {
      return errorResponse("Validation error", 400, "VALIDATION_ERROR", result.error.issues);
    }

    const { address, radius, competitorCount, lat, lng } = result.data;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return errorResponse(
        "Location coordinates required. Please geocode address first.",
        400,
        "MISSING_COORDINATES"
      );
    }

    const job = await enqueueAnalysisJob({
      address,
      lat,
      lng,
      radius,
      competitorCount,
    });

    return successResponse(
      { jobId: job.id, ...toPublicJob(job) },
      "Analysis job queued",
      202
    );
  } catch (error: any) {
    console.error("Search queue error:", error);
    return errorResponse("Failed to queue competitor search", 500, "INTERNAL_ERROR");
  }
}
