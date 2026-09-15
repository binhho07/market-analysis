"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";
import { loadGoogleMapsScript } from "@/lib/google-maps-loader";

interface Competitor {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  rating?: number;
  distanceMiles?: number;
}

interface GoogleMapViewProps {
  center: { lat: number; lng: number };
  competitors: Competitor[];
  yourLocation?: { lat: number; lng: number };
  onMarkerClick?: (competitor: Competitor) => void;
}


export function GoogleMapView({
  center,
  competitors,
  yourLocation,
  onMarkerClick,
}: GoogleMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error("Google Maps API key not configured");
        }

        // Load Google Maps script (only once globally)
        await loadGoogleMapsScript(apiKey);

        if (!mapRef.current) return;

        // Create map
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: "poi.business",
              stylers: [{ visibility: "off" }],
            },
          ],
        });

        googleMapRef.current = map;

        // Clear existing markers
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        // Add your location marker (green)
        if (yourLocation) {
          const yourMarker = new google.maps.Marker({
            position: yourLocation,
            map,
            title: "Your Salon",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#10b981",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
            zIndex: 1000,
          });

          const yourInfoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px;">
                <h3 style="font-weight: bold; margin-bottom: 4px;">Your Location</h3>
                <p style="color: #666; font-size: 14px;">Search center</p>
              </div>
            `,
          });

          yourMarker.addListener("click", () => {
            yourInfoWindow.open(map, yourMarker);
          });

          markersRef.current.push(yourMarker);
        }

        // Add competitor markers (red)
        competitors.forEach((competitor, index) => {
          const marker = new google.maps.Marker({
            position: competitor.location,
            map,
            title: competitor.name,
            label: {
              text: String(index + 1),
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: "bold",
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: "#ef4444",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; max-width: 250px;">
                <h3 style="font-weight: bold; margin-bottom: 8px; font-size: 16px;">${competitor.name}</h3>
                ${competitor.rating ? `
                  <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                    <span style="color: #fbbf24;">⭐</span>
                    <span style="font-weight: 600;">${competitor.rating}</span>
                  </div>
                ` : ''}
                ${competitor.distanceMiles ? `
                  <p style="color: #666; font-size: 14px; margin-bottom: 0;">
                    ${competitor.distanceMiles} miles away
                  </p>
                ` : ''}
              </div>
            `,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
            if (onMarkerClick) {
              onMarkerClick(competitor);
            }
          });

          markersRef.current.push(marker);
        });

        // Fit bounds to show all markers
        if (competitors.length > 0 || yourLocation) {
          const bounds = new google.maps.LatLngBounds();
          
          if (yourLocation) {
            bounds.extend(yourLocation);
          }
          
          competitors.forEach((competitor) => {
            bounds.extend(competitor.location);
          });

          map.fitBounds(bounds);

          // Adjust zoom if only one competitor
          if (competitors.length === 1 && !yourLocation) {
            map.setZoom(15);
          }
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error("Map initialization error:", err);
        setError(err.message || "Failed to load map");
        setIsLoading(false);
      }
    };

    initMap();

    // Cleanup
    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, [center, competitors, yourLocation, onMarkerClick]);

  return (
    <Card className="w-full h-full rounded-2xl shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-bold">
          <MapPin className="mr-2 h-5 w-5" />
          Location Map
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="w-full h-[400px] flex items-center justify-center bg-gray-100 rounded-xl">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-2" />
              <p className="text-gray-600">Loading map...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="w-full h-[400px] flex items-center justify-center bg-red-50 rounded-xl border-2 border-red-200">
            <div className="text-center px-4">
              <p className="text-red-600 font-medium mb-2">Failed to load map</p>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          </div>
        )}

        <div
          ref={mapRef}
          className={`w-full h-[400px] rounded-xl ${isLoading || error ? "hidden" : ""}`}
        />
      </CardContent>
    </Card>
  );
}



