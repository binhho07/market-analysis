"use client";

import { GoogleMapView } from "@/components/GoogleMapView";

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
  return (
    <GoogleMapView
      center={center}
      competitors={competitors}
      yourLocation={center}
    />
  );
}

