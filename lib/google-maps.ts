import { Client, LatLngLiteral } from "@googlemaps/google-maps-services-js";

const client = new Client({});
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

if (!GOOGLE_MAPS_API_KEY) {
  console.warn("⚠️  GOOGLE_MAPS_API_KEY not set. Google Maps features will not work.");
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  businessStatus?: string;
  types?: string[];
  photos?: string[];
  website?: string;
  phoneNumber?: string;
  openingHours?: {
    openNow?: boolean;
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
    weekdayText?: string[];
  };
}

/**
 * Geocode an address to lat/lng coordinates
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key not configured");
  }

  try {
    const response = await client.geocode({
      params: {
        address,
        key: GOOGLE_MAPS_API_KEY,
        components: { country: "US" }, // Restrict to US
      },
    });

    if (response.data.results.length === 0) {
      return null;
    }

    const result = response.data.results[0];
    const location = result.geometry.location;
    
    // Extract address components
    const addressComponents = result.address_components;
    const city = addressComponents.find((c) => c.types.includes("locality"))?.long_name;
    const state = addressComponents.find((c) => c.types.includes("administrative_area_level_1"))?.short_name;
    const country = addressComponents.find((c) => c.types.includes("country"))?.short_name;
    const postalCode = addressComponents.find((c) => c.types.includes("postal_code"))?.long_name;

    return {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address,
      city,
      state,
      country,
      postalCode,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    throw new Error("Failed to geocode address");
  }
}

/**
 * Search for nail salons/spas near a location
 */
export async function searchNearbyPlaces(
  location: LatLngLiteral,
  radiusMeters: number = 8000, // ~5 miles
  keyword: string = "nail salon"
): Promise<PlaceSearchResult[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key not configured");
  }

  try {
    const response = await client.placesNearby({
      params: {
        location,
        radius: radiusMeters,
        keyword,
        type: "beauty_salon",
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    const places = response.data.results || [];
    
    return places.map((place) => ({
      placeId: place.place_id || "",
      name: place.name || "Unknown",
      address: place.vicinity || place.formatted_address || "",
      location: {
        lat: place.geometry?.location?.lat || 0,
        lng: place.geometry?.location?.lng || 0,
      },
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      priceLevel: place.price_level,
      businessStatus: place.business_status,
      types: place.types,
      photos: place.photos?.map((p) => p.photo_reference) || [],
    }));
  } catch (error) {
    console.error("Places search error:", error);
    throw new Error("Failed to search nearby places");
  }
}

/**
 * Get detailed information about a place
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceSearchResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key not configured");
  }

  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: [
          "place_id",
          "name",
          "formatted_address",
          "geometry",
          "rating",
          "user_ratings_total",
          "price_level",
          "business_status",
          "types",
          "photos",
          "website",
          "formatted_phone_number",
          "opening_hours",
          "reviews",
        ],
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    const place = response.data.result;
    if (!place) return null;

    return {
      placeId: place.place_id || "",
      name: place.name || "Unknown",
      address: place.formatted_address || "",
      location: {
        lat: place.geometry?.location?.lat || 0,
        lng: place.geometry?.location?.lng || 0,
      },
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      priceLevel: place.price_level,
      businessStatus: place.business_status,
      types: place.types,
      photos: place.photos?.map((p) => p.photo_reference) || [],
      website: place.website,
      phoneNumber: place.formatted_phone_number,
      openingHours: place.opening_hours
        ? {
            openNow: place.opening_hours.open_now,
            periods: place.opening_hours.periods,
            weekdayText: place.opening_hours.weekday_text,
          }
        : undefined,
    };
  } catch (error) {
    console.error("Place details error:", error);
    throw new Error("Failed to get place details");
  }
}

/**
 * Calculate distance between two points in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get photo URL from photo reference
 */
export function getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
  if (!GOOGLE_MAPS_API_KEY) return "";
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_MAPS_API_KEY}`;
}



