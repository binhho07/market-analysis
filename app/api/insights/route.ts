import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildEvidencePack } from "@/lib/analysis/evidence";
import { writeGroundedReport } from "@/lib/analysis/llm-report";

const schema = z.object({
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  radius: z.number().optional(),
  competitors: z.array(z.any()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse("Competitors required", 400, "VALIDATION_ERROR");
    }

    const evidence = buildEvidencePack(parsed.data.competitors, {
      address: parsed.data.address,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radiusMiles: parsed.data.radius,
    });
    const report = await writeGroundedReport(evidence);

    return successResponse({ evidence, report });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to build insights", 500, "INSIGHTS_ERROR");
  }
}
