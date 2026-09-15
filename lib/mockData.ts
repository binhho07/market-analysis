export interface Competitor {
  id: string;
  name: string;
  website: string;
  rating: number;
  reviewCount: number;
  priceRange: string;
  samplePrices: {
    gel: number;
    pedicure: number;
    acrylic: number;
  };
  staffBand: string;
  hoursPerWeek: number;
  amenities: string[];
  distanceMiles: number;
}
