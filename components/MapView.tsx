"use client";

import { OsmMapView } from "@/components/OsmMapView";

interface MapViewProps {
  competitors: Array<{
    id: string;
    name: string;
    location: { lat: number; lng: number };
    rating?: number;
    distanceMiles?: number;
  }>;
  center: { lat: number; lng: number };
}

export function MapView({ competitors, center }: MapViewProps) {
  return <OsmMapView center={center} competitors={competitors} />;
}
