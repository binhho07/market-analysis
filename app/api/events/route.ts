import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 40), 100);
    const events = await prisma.marketEvent.findMany({
      orderBy: { detectedAt: "desc" },
      take: limit,
      include: { watchTarget: { select: { label: true } } },
    });
    const unread = await prisma.marketEvent.count({ where: { readAt: null } });
    return successResponse({ events, unread });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load market events", 500, "EVENTS_ERROR");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
    await prisma.marketEvent.updateMany({
      where: ids.length ? { id: { in: ids } } : { readAt: null },
      data: { readAt: new Date() },
    });
    return successResponse({ marked: true });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to update events", 500, "EVENTS_ERROR");
  }
}
