"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadGoogleMapsScript } from "@/lib/google-maps-loader";

interface Competitor {
  name: string;
  latitude: number;
  longitude: number;
  rating: number;
  reviewCount: number;
  priceRange: string;
}

interface HeatMapViewProps {
  competitors: Competitor[];
  searchLocation: { lat: number; lng: number };
}


export function HeatMapView({ competitors, searchLocation }: HeatMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [heatmap, setHeatmap] = useState<google.maps.visualization.HeatmapLayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initMap = async () => {
      setLoading(true);
      setError(null);

      try {
        // Validate input data
        if (!Array.isArray(competitors) || competitors.length === 0) {
          setError("No competitor data available");
          setLoading(false);
          return;
        }

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          setError("Google Maps API key not configured");
          setLoading(false);
          return;
        }

        if (!mapRef.current) {
          setError("Map container not found");
          setLoading(false);
          return;
        }

        // Load Google Maps script
        await loadGoogleMapsScript(apiKey);

        if (!window.google || !window.google.maps) {
          setError("Google Maps failed to load");
          setLoading(false);
          return;
        }

        // Create map
        const googleMap = new google.maps.Map(mapRef.current, {
          center: searchLocation,
          zoom: 12,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          styles: [
            {
              featureType: "all",
              elementType: "geometry",
              stylers: [{ color: "#f5f5f5" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#c9c9c9" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#ffffff" }],
            },
          ],
        });

        setMap(googleMap);

        // Add search location marker
        new google.maps.Marker({
          position: searchLocation,
          map: googleMap,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#3B82F6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          title: "Search Location",
        });

        // Prepare heat map data with validation
        const heatmapData = Array.isArray(competitors) 
          ? competitors
              .filter((competitor: any) => {
                // Get coordinates from various possible formats
                const lat = competitor.latitude ?? competitor.location?.lat ?? competitor.lat;
                const lng = competitor.longitude ?? competitor.location?.lng ?? competitor.lng;
                
                // Validate coordinates
                const hasValidCoords = 
                  typeof lat === 'number' && 
                  typeof lng === 'number' &&
                  !isNaN(lat) &&
                  !isNaN(lng);
                return hasValidCoords;
              })
              .map((competitor: any) => {
                // Get coordinates from various possible formats
                const lat = competitor.latitude ?? competitor.location?.lat ?? competitor.lat;
                const lng = competitor.longitude ?? competitor.location?.lng ?? competitor.lng;
                
                const location = new google.maps.LatLng(lat, lng);
                
                // Weight by rating and review count for competitive intensity
                const rating = Number(competitor.rating) || 0;
                const reviewCount = Number(competitor.reviewCount) || 0;
                const weight = (rating / 5) * Math.log(reviewCount + 1);
                
                return {
                  location,
                  weight: Math.max(1, isNaN(weight) ? 1 : weight),
                };
              })
          : [];
        
        // If no valid data, don't create heatmap
        if (heatmapData.length === 0) {
          setError("No valid competitor location data for heat map");
          setLoading(false);
          return;
        }

        // Create heat map layer
        const heatmapLayer = new google.maps.visualization.HeatmapLayer({
          data: heatmapData,
          map: googleMap,
          radius: 30,
          opacity: 0.7,
          gradient: [
            "rgba(0, 255, 255, 0)",
            "rgba(0, 255, 255, 1)",
            "rgba(0, 191, 255, 1)",
            "rgba(0, 127, 255, 1)",
            "rgba(0, 63, 255, 1)",
            "rgba(0, 0, 255, 1)",
            "rgba(0, 0, 223, 1)",
            "rgba(0, 0, 191, 1)",
            "rgba(0, 0, 159, 1)",
            "rgba(0, 0, 127, 1)",
            "rgba(63, 0, 91, 1)",
            "rgba(127, 0, 63, 1)",
            "rgba(191, 0, 31, 1)",
            "rgba(255, 0, 0, 1)",
          ],
        });

        setHeatmap(heatmapLayer);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load heat map:", err);
        setError(err instanceof Error ? err.message : "Failed to load map");
        setLoading(false);
      }
    };

    initMap();

    return () => {
      if (heatmap) {
        heatmap.setMap(null);
      }
    };
  }, [competitors, searchLocation]);

  // Calculate density statistics
  const calculateDensityStats = () => {
    if (competitors.length === 0) return null;

    // Simple grid-based density calculation
    const gridSize = 0.02; // ~2 km grid cells
    const grid: { [key: string]: number } = {};

    competitors.forEach((comp) => {
      const gridKey = `${Math.floor(comp.latitude / gridSize)},${Math.floor(comp.longitude / gridSize)}`;
      grid[gridKey] = (grid[gridKey] || 0) + 1;
    });

    const densities = Object.values(grid);
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

  if (error) {
    return (
      <Card className="w-full bg-white border border-gray-200">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-900">Competitive Density Heat Map</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Failed to load heat map: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-white border border-gray-200">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="text-lg font-bold text-gray-900">Competitive Density Heat Map</CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Spatial visualization of competitor concentration and competitive intensity
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {loading && (
          <div className="flex items-center justify-center h-96 bg-gray-50 border border-gray-200 rounded">
            <div className="text-gray-500">Loading heat map...</div>
          </div>
        )}

        <div
          ref={mapRef}
          className={`w-full h-96 border border-gray-300 rounded ${loading ? "hidden" : ""}`}
        />

        {!loading && densityStats && (
          <div className="bg-gray-50 border-l-4 border-gray-900 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Spatial Density Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
              <div className="bg-white p-2 rounded border border-gray-200">
                <div className="text-gray-600 mb-1">Max Density</div>
                <div className="text-lg font-bold text-gray-900">{densityStats.maxDensity}</div>
                <div className="text-gray-500">per grid cell</div>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <div className="text-gray-600 mb-1">Avg Density</div>
                <div className="text-lg font-bold text-gray-900">{densityStats.avgDensity}</div>
                <div className="text-gray-500">per grid cell</div>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <div className="text-gray-600 mb-1">Hot Zones</div>
                <div className="text-lg font-bold text-gray-900">{densityStats.highDensityCells}</div>
                <div className="text-gray-500">high density areas</div>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200">
                <div className="text-gray-600 mb-1">Coverage</div>
                <div className="text-lg font-bold text-gray-900">{densityStats.totalCells}</div>
                <div className="text-gray-500">total grid cells</div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-gray-700">
              <strong>Interpretation:</strong> Heat intensity reflects combined competitive strength 
              (rating quality × review volume). Red zones indicate saturated high-competition areas; 
              blue zones represent moderate competition. Uncolored areas suggest potential geographic gaps 
              for market entry. The search location (blue marker) position relative to heat concentrations 
              indicates competitive pressure level.
            </p>
          </div>
        )}

        {!loading && (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#00FFFF" }}></div>
              <span className="text-gray-700">Low Density</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#0000FF" }}></div>
              <span className="text-gray-700">Medium Density</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#7F003F" }}></div>
              <span className="text-gray-700">High Density</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#FF0000" }}></div>
              <span className="text-gray-700">Saturation</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

