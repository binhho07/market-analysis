"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface Competitor {
  id?: string;
  name: string;
  location?: { lat: number; lng: number };
  latitude?: number;
  longitude?: number;
  rating?: number;
  distanceMiles?: number;
}

interface OsmMapViewProps {
  center: { lat: number; lng: number };
  competitors?: Competitor[];
  title?: string;
  description?: string;
}

function coords(competitor: Competitor) {
  const lat = competitor.location?.lat ?? competitor.latitude;
  const lng = competitor.location?.lng ?? competitor.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

export function OsmMapView({
  center,
  competitors = [],
  title = "Location Map",
  description,
}: OsmMapViewProps) {
  const pad = 0.06;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${center.lng - pad}%2C${center.lat - pad}%2C${center.lng + pad}%2C${center.lat + pad}&layer=mapnik&marker=${center.lat}%2C${center.lng}`;

  return (
    <Card className="w-full h-full rounded-2xl shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-bold">
          <MapPin className="mr-2 h-5 w-5" />
          {title}
        </CardTitle>
        {description ? (
          <p className="text-sm text-gray-600">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <iframe
          title={title}
          src={src}
          className="h-[400px] w-full rounded-xl border border-gray-200"
        />
        {competitors.length > 0 && (
          <ul className="max-h-40 space-y-2 overflow-auto text-sm">
            {competitors.slice(0, 12).map((competitor, index) => {
              const point = coords(competitor);
              const href = point
                ? `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=16/${point.lat}/${point.lng}`
                : undefined;
              return (
                <li key={competitor.id || `${competitor.name}-${index}`} className="flex justify-between gap-3">
                  <span className="font-medium text-gray-900">
                    {index + 1}. {competitor.name}
                  </span>
                  <span className="shrink-0 text-gray-500">
                    {competitor.distanceMiles ? `${competitor.distanceMiles} mi` : ""}
                    {href ? (
                      <>
                        {" "}
                        <a className="text-blue-600 hover:underline" href={href} target="_blank" rel="noreferrer">
                          Map
                        </a>
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
