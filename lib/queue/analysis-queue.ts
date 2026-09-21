import { createHash } from "crypto";
import { Queue, Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { emptyProgress, type AnalysisJobPayload, type AnalysisJobPublic, type AnalysisProgress } from "@/lib/analysis/types";
import { processAnalysisJob } from "@/lib/analysis/pipeline";
import { getQueueConnection } from "./connection";

export const ANALYSIS_QUEUE = "analysis-jobs";

let queue: Queue | null | undefined;
let worker: Worker | null = null;
const inFlight = new Set<string>();

function idempotencyKey(payload: Omit<AnalysisJobPayload, "jobId">) {
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));
  return createHash("sha256")
    .update(
      [
        payload.address.trim().toLowerCase(),
        payload.lat.toFixed(4),
        payload.lng.toFixed(4),
        payload.radius,
        payload.competitorCount,
        bucket,
      ].join("|")
    )
    .digest("hex");
}

export function getAnalysisQueue() {
  if (queue !== undefined) return queue;
  const connection = getQueueConnection();
  if (!connection) {
    queue = null;
    return null;
  }
  queue = new Queue(ANALYSIS_QUEUE, { connection });
  return queue;
}

export async function startAnalysisWorker() {
  if (worker) return worker;
  const connection = getQueueConnection();
  if (!connection) {
    console.warn("REDIS_URL not set — analysis jobs will run in-process");
    return null;
  }

  worker = new Worker(
    ANALYSIS_QUEUE,
    async (job) => {
      await processAnalysisJob(job.data as AnalysisJobPayload);
    },
    {
      connection,
      concurrency: 2,
      limiter: {
        max: 6,
        duration: 60_000,
      },
    }
  );

  worker.on("failed", (job, error) => {
    console.error(`Analysis job ${job?.id} failed:`, error.message);
  });

  console.log("Analysis worker started (BullMQ, concurrency=2)");
  return worker;
}

export async function enqueueAnalysisJob(input: Omit<AnalysisJobPayload, "jobId">) {
  const key = idempotencyKey(input);
  const existing = await prisma.analysisJob.findUnique({
    where: { idempotencyKey: key },
  });

  if (existing) {
    if (existing.status === "failed") {
      const retried = await prisma.analysisJob.update({
        where: { id: existing.id },
        data: {
          status: "queued",
          stage: "queued",
          error: null,
          finishedAt: null,
          progress: emptyProgress() as object,
        },
      });
      const payload: AnalysisJobPayload = { ...input, jobId: retried.id };
      const bullQueue = getAnalysisQueue();
      if (bullQueue) {
        await bullQueue.add("run", payload, {
          jobId: `${retried.id}:${Date.now()}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        });
      } else {
        runInProcess(payload);
      }
      return retried;
    }
    return existing;
  }

  const job = await prisma.analysisJob.create({
    data: {
      address: input.address,
      latitude: input.lat,
      longitude: input.lng,
      radiusMiles: input.radius,
      competitorCount: input.competitorCount,
      idempotencyKey: key,
      status: "queued",
      stage: "queued",
      progress: emptyProgress() as object,
    },
  });

  const payload: AnalysisJobPayload = { ...input, jobId: job.id };
  const bullQueue = getAnalysisQueue();

  if (bullQueue) {
    await bullQueue.add("run", payload, {
      jobId: job.id,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    });
  } else {
    runInProcess(payload);
  }

  return job;
}

function runInProcess(payload: AnalysisJobPayload) {
  if (inFlight.has(payload.jobId)) return;
  inFlight.add(payload.jobId);
  setImmediate(() => {
    processAnalysisJob(payload)
      .catch((error) => {
        console.error("In-process analysis job failed:", error);
      })
      .finally(() => {
        inFlight.delete(payload.jobId);
      });
  });
}

export function toPublicJob(job: {
  id: string;
  status: string;
  stage: string;
  progress: unknown;
  result: unknown;
  error: string | null;
}): AnalysisJobPublic {
  return {
    id: job.id,
    status: job.status as AnalysisJobPublic["status"],
    stage: job.stage,
    progress: {
      ...emptyProgress(),
      ...((job.progress as AnalysisProgress | null) || {}),
    },
    result: (job.result as AnalysisJobPublic["result"]) || null,
    error: job.error,
  };
}
