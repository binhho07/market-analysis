import { prisma } from "@/lib/prisma";

const MATCH_DELTA = 0.002;

export async function upsertWatchTarget(input: {
  label: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  placeId?: string;
  watched?: boolean;
  monitorArea?: boolean;
}) {
  const radius = Number(input.radiusMiles) || 5;
  const existing = await prisma.watchTarget.findFirst({
    where: {
      latitude: { gte: input.latitude - MATCH_DELTA, lte: input.latitude + MATCH_DELTA },
      longitude: { gte: input.longitude - MATCH_DELTA, lte: input.longitude + MATCH_DELTA },
      radiusMiles: radius,
    },
  });

  const placeIds = new Set(existing?.placeIds || []);
  if (input.placeId) {
    if (input.watched === false) placeIds.delete(input.placeId);
    else placeIds.add(input.placeId);
  }

  const monitorArea = input.monitorArea ?? existing?.monitorArea ?? false;
  const enabled = monitorArea || placeIds.size > 0;

  if (!existing) {
    return prisma.watchTarget.create({
      data: {
        label: input.label,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMiles: radius,
        placeIds: Array.from(placeIds),
        monitorArea,
        enabled,
      },
    });
  }

  return prisma.watchTarget.update({
    where: { id: existing.id },
    data: {
      label: input.label || existing.label,
      placeIds: Array.from(placeIds),
      monitorArea,
      enabled,
    },
  });
}

export async function listWatchTargets() {
  return prisma.watchTarget.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "desc" },
  });
}
