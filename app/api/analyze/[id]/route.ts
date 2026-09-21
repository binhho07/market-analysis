import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { toPublicJob } from "@/lib/queue/analysis-queue";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await prisma.analysisJob.findUnique({ where: { id } });

  if (!job) {
    return errorResponse("Analysis job not found", 404, "NOT_FOUND");
  }

  return successResponse(toPublicJob(job));
}
