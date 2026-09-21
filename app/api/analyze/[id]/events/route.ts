import { prisma } from "@/lib/prisma";
import { toPublicJob } from "@/lib/queue/analysis-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const tick = async () => {
        const job = await prisma.analysisJob.findUnique({ where: { id } });
        if (!job) {
          send({ error: "NOT_FOUND" });
          controller.close();
          return true;
        }

        const publicJob = toPublicJob(job);
        send(publicJob);
        return publicJob.status === "completed" || publicJob.status === "failed";
      };

      try {
        let done = await tick();
        while (!done && !request.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          done = await tick();
        }
      } catch (error) {
        send({ error: error instanceof Error ? error.message : "stream failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
