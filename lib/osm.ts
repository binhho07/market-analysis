import type { GeocodingResult, PlaceSearchResult } from "@/lib/google-maps";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "SpaAtlas/1.0 (local market analysis; https://github.com/binhho07/market-analysis)";

type NominatimItem = {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

async function nominatimGet(path: string): Promise<NominatimItem[]> {
  const response = await fetch(`${NOMINATIM_URL}${path}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap search failed (${response.status})`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export interface OsmSuggestion {
  id: string;
  label: string;
  description: string;
  lat: number;
  lng: number;
}

export async function osmAutocomplete(query: string): Promise<OsmSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "us",
    q,
  });

  const results = await nominatimGet(`/search?${params.toString()}`);

  return results.map((item) => {
    const label = item.name || item.display_name.split(",")[0];
    return {
      id: osmPlaceId(item),
      label,
      description: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    };
  });
}

export async function osmGeocode(address: string): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
    countrycodes: "us",
    q: address,
  });

  const [item] = await nominatimGet(`/search?${params.toString()}`);
  if (!item) return null;

  return {
    lat: Number(item.lat),
    lng: Number(item.lon),
    formattedAddress: item.display_name,
    city: item.address?.city || item.address?.town || item.address?.village,
    state: item.address?.state,
    country: item.address?.country,
    postalCode: item.address?.postcode,
  };
}

export async function osmNearbyPlaces(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<PlaceSearchResult[]> {
  const radius = Math.min(Math.max(radiusMeters, 500), 20000);
  const query = `
    [out:json][timeout:20];
    (
      nwr["shop"="beauty"](around:${radius},${lat},${lng});
      nwr["shop"="hairdresser"](around:${radius},${lat},${lng});
      nwr["amenity"="spa"](around:${radius},${lat},${lng});
      nwr["leisure"="spa"](around:${radius},${lat},${lng});
    );
    out center 40;
  `;

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap places search failed (${response.status})`);
  }

  const data = await response.json();
  const elements = Array.isArray(data?.elements) ? data.elements : [];

  return elements
    .map((element: any) => {
      const location = {
        lat: Number(element.lat ?? element.center?.lat),
        lng: Number(element.lon ?? element.center?.lon),
      };
      if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;

      const tags = element.tags || {};
      const name = tags.name || "Unnamed salon";
      const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:state"]]
        .filter(Boolean)
        .join(" ");

      return {
        placeId: `osm:${element.type}:${element.id}`,
        name,
        address: address || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
        location,
        website: tags.website || tags["contact:website"],
        phoneNumber: tags.phone || tags["contact:phone"],
        types: [tags.shop || tags.amenity || tags.leisure].filter(Boolean),
      } as PlaceSearchResult;
    })
    .filter((place): place is PlaceSearchResult => Boolean(place))
    .sort((a: PlaceSearchResult, b: PlaceSearchResult) => {
      return distanceMiles(lat, lng, a.location.lat, a.location.lng) -
        distanceMiles(lat, lng, b.location.lat, b.location.lng);
    });
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function osmLookupPlace(placeId: string): Promise<PlaceSearchResult | null> {
  const match = placeId.match(/^osm:(node|way|relation):(\d+)$/);
  if (!match) return null;

  const prefix = match[1][0].toUpperCase();
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    osm_ids: `${prefix}${match[2]}`,
  });

  const [item] = await nominatimGet(`/lookup?${params.toString()}`);
  if (!item) return null;

  return {
    placeId,
    name: item.name || item.display_name.split(",")[0],
    address: item.display_name,
    location: {
      lat: Number(item.lat),
      lng: Number(item.lon),
    },
  };
}

function osmPlaceId(item: NominatimItem): string {
  if (item.osm_type && item.osm_id) {
    return `osm:${item.osm_type}:${item.osm_id}`;
  }
  return `osm:place:${item.place_id}`;
}
