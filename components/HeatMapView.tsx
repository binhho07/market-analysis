"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OsmMapView } from "@/components/OsmMapView";

interface Competitor {
  name: string;
  latitude?: number;
  longitude?: number;
  location?: { lat: number; lng: number };
  rating: number;
  reviewCount: number;
  priceRange: string;
  distanceMiles?: number;
}

interface HeatMapViewProps {
  competitors: Competitor[];
  searchLocation: { lat: number; lng: number };
}

export function HeatMapView({ competitors, searchLocation }: HeatMapViewProps) {
  const calculateDensityStats = () => {
    if (competitors.length === 0) return null;

    const gridSize = 0.02;
    const grid: { [key: string]: number } = {};

    competitors.forEach((comp) => {
      const lat = comp.latitude ?? comp.location?.lat ?? 0;
      const lng = comp.longitude ?? comp.location?.lng ?? 0;
      const gridKey = `${Math.floor(lat / gridSize)},${Math.floor(lng / gridSize)}`;
      grid[gridKey] = (grid[gridKey] || 0) + 1;
    });

    const densities = Object.values(grid);
    if (densities.length === 0) return null;
    const maxDensity = Math.max(...densities);
    const avgDensity = densities.reduce((a, b) => a + b, 0) / densities.length;
    const highDensityCells = densities.filter((d) => d >= avgDensity * 1.5).length;

    return {
      maxDensity,
      avgDensity: avgDensity.toFixed(1),
      highDensityCells,
      totalCells: densities.length,
    };
  };

  const densityStats = calculateDensityStats();

  return (
    <div className="space-y-4">
      <OsmMapView
        center={searchLocation}
        competitors={competitors}
        title="Competitive Density Map"
        description="OpenStreetMap view of nearby competitors. Google Maps is disabled because billing is not enabled on the Google Cloud project."
      />
      {densityStats && (
        <Card className="w-full bg-white border border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900">Spatial Density Analysis</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2 rounded border border-gray-200">
                <div className="text-gray-600 mb-1">Max Density</div>
                <div className="text-lg font-bold text-gray-900">{densityStats.maxDensity}</div>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <div className="text-gray-600 mb-1">Avg Density</div>
                <div className="text-lg font-bold text-gray-900">{densityStats.avgDensity}</div>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <div className="text-gray-600 mb-1">Hot Zones</div>
                <div className="text-lg font-bold text-gray-900">{densityStats.highDensityCells}</div>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <div className="text-gray-600 mb-1">Coverage</div>
                <div className="text-lg font-bold text-gray-900">{densityStats.totalCells}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
