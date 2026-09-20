import { NextRequest } from "next/server";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api-response";
import { osmAutocomplete } from "@/lib/osm";

const schema = z.object({
  q: z.string().min(2).max(200),
});

export async function GET(request: NextRequest) {
  try {
    const result = schema.safeParse({
      q: request.nextUrl.searchParams.get("q") || "",
    });

    if (!result.success) {
      return errorResponse("Enter at least 2 characters", 400, "VALIDATION_ERROR");
    }

    const suggestions = await osmAutocomplete(result.data.q);
    return successResponse({ suggestions });
  } catch (error: any) {
    console.error("Autocomplete error:", error);
    return errorResponse(
      error.message || "Failed to fetch address suggestions",
      500,
      "AUTOCOMPLETE_ERROR"
    );
  }
}
