import type { DataPoint } from "./provenance";

export interface Competitor {
  id: string;
  name: string;
  website: string;
  address?: string;
  rating: number;
  reviewCount: number;
  priceRange: string;
  samplePrices: {
    gel: number | DataPoint<number | null>;
    pedicure: number | DataPoint<number | null>;
    acrylic: number | DataPoint<number | null>;
  };
  staffBand: string | DataPoint<string | null>;
  hoursPerWeek: number | DataPoint<number | null>;
  amenities: string[] | DataPoint<string[]>;
  distanceMiles: number;
}
