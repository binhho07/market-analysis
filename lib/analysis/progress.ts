import { prisma } from "@/lib/prisma";
import {
  emptyProgress,
  type AnalysisProgress,
  type AnalysisStage,
  type StageStatus,
} from "./types";

export async function setJobProgress(
  jobId: string,
  stage: AnalysisStage | "queued" | "done",
  patch: Partial<AnalysisProgress> = {},
  extra: {
    status?: string;
    attempts?: number;
    error?: string | null;
    result?: object | null;
  } = {}
) {
  const current = await prisma.analysisJob.findUnique({
    where: { id: jobId },
    select: { progress: true },
  });

  const progress = {
    ...emptyProgress(),
    ...((current?.progress as AnalysisProgress | null) || {}),
    ...patch,
  };

  const data: Record<string, unknown> = {
    stage,
    progress,
  };

  if (extra.status) data.status = extra.status;
  if (typeof extra.attempts === "number") data.attempts = extra.attempts;
  if (extra.error !== undefined) data.error = extra.error;
  if (extra.result !== undefined) data.result = extra.result;
  if (extra.status === "running" && stage === "places") {
    data.startedAt = new Date();
  }
  if (extra.status === "completed" || extra.status === "failed") {
    data.finishedAt = new Date();
  }

  return prisma.analysisJob.update({
    where: { id: jobId },
    data,
  });
}

export function markStage(
  progress: AnalysisProgress,
  stage: AnalysisStage,
  status: StageStatus,
  current: number,
  total: number
): AnalysisProgress {
  return {
    ...progress,
    [stage]: {
      ...progress[stage],
      status,
      current,
      total,
    },
  };
}
