/**
 * Price extraction patterns and utilities
 */

export interface ServicePrice {
  serviceName: string;
  serviceType: string;
  price: number;
  priceRange?: { min: number; max: number };
  duration?: number;
  confidence: number; // 0-1
  source: string;
}

/**
 * Service name patterns to detect service types (EXPANDED)
 */
export const SERVICE_PATTERNS = {
  gel: /gel\s*(manicure|mani|nails?|polish|color)?|shellac|cnd|soak\s*off/i,
  pedicure: /pedicure|pedi|foot\s*(spa|treatment|care|massage)|spa\s*pedi/i,
  acrylic: /acrylic|full\s*set|extensions?|pink\s*&\s*white|sculpt|tips/i,
  dip: /dip\s*powder|dipping|sns|powder\s*gel/i,
  manicure: /manicure|mani(?![cp])|basic\s*mani|classic\s*mani/i,
  waxing: /waxing|wax|hair\s*removal/i,
  massage: /massage|reflexology/i,
  "gel-removal": /gel\s*removal|soak\s*off|removal/i,
  "nail-art": /nail\s*art|design|custom|decal|crystal|rhinestone/i,
};

/**
 * Price patterns to extract prices from text (EXPANDED)
 */
export const PRICE_PATTERNS = [
  // $50 or $50.00
  /\$\s*(\d+(?:\.\d{2})?)/g,
  // $40-$60 or $40 - $60 or $40-60
  /\$\s*(\d+(?:\.\d{2})?)\s*[-–]\s*\$?\s*(\d+(?:\.\d{2})?)/g,
  // 50 USD or 50.00 USD
  /(\d+(?:\.\d{2})?)\s*USD/gi,
  // Price: 50 or Price: $50
  /price:?\s*\$?\s*(\d+(?:\.\d{2})?)/gi,
  // Starting at $50
  /starting\s*(?:at|from)\s*\$?\s*(\d+(?:\.\d{2})?)/gi,
  // 50.00 (standalone number that could be a price)
  /\b(\d{2,3}\.\d{2})\b/g,
  // From $50
  /from\s*\$\s*(\d+(?:\.\d{2})?)/gi,
];

/**
 * Duration patterns
 */
export const DURATION_PATTERNS = [
  /(\d+)\s*(?:mins?|minutes?)/i,
  /(\d+)\s*(?:hrs?|hours?)/i,
  /(\d+)h\s*(\d+)?m?/i,
];

/**
 * Detect service type from service name
 */
export function detectServiceType(serviceName: string): string {
  const lowerName = serviceName.toLowerCase();
  
  for (const [type, pattern] of Object.entries(SERVICE_PATTERNS)) {
    if (pattern.test(lowerName)) {
      return type;
    }
  }
  
  return "other";
}

/**
 * Extract prices from text
 */
export function extractPrices(text: string): number[] {
  const prices: number[] = [];
  
  for (const pattern of PRICE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const price = parseFloat(match[1]);
        if (price > 0 && price < 1000) { // Reasonable price range
          prices.push(price);
        }
      }
      if (match[2]) {
        const price = parseFloat(match[2]);
        if (price > 0 && price < 1000) {
          prices.push(price);
        }
      }
    }
  }
  
  return [...new Set(prices)]; // Remove duplicates
}

/**
 * Extract price range from text
 */
export function extractPriceRange(text: string): { min: number; max: number } | null {
  const rangePattern = /\$\s*(\d+(?:\.\d{2})?)\s*-\s*\$?\s*(\d+(?:\.\d{2})?)/;
  const match = text.match(rangePattern);
  
  if (match && match[1] && match[2]) {
    const min = parseFloat(match[1]);
    const max = parseFloat(match[2]);
    
    if (min < max && min > 0 && max < 1000) {
      return { min, max };
    }
  }
  
  return null;
}

/**
 * Extract duration from text
 */
export function extractDuration(text: string): number | null {
  for (const pattern of DURATION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      if (match[2]) {
        // Format: 1h30m
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        return hours * 60 + minutes;
      } else if (text.includes("hour") || text.includes("hr")) {
        // Format: 2 hours
        return parseInt(match[1]) * 60;
      } else {
        // Format: 45 minutes
        return parseInt(match[1]);
      }
    }
  }
  
  return null;
}

/**
 * Parse service menu item
 */
export function parseServiceItem(
  serviceName: string,
  priceText: string,
  source: string
): ServicePrice | null {
  const prices = extractPrices(priceText);
  const priceRange = extractPriceRange(priceText);
  const duration = extractDuration(serviceName + " " + priceText);
  const serviceType = detectServiceType(serviceName);
  
  if (prices.length === 0 && !priceRange) {
    return null;
  }
  
  // Determine confidence based on clarity of price
  let confidence = 0.8;
  if (priceRange) {
    confidence = 0.9;
  } else if (prices.length > 1) {
    confidence = 0.7;
  }
  
  const price = prices[0] || (priceRange ? priceRange.min : 0);
  
  return {
    serviceName: serviceName.trim(),
    serviceType,
    price,
    priceRange: priceRange || undefined,
    duration: duration || undefined,
    confidence,
    source,
  };
}

/**
 * Clean and normalize service name
 */
export function normalizeServiceName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase();
}

/**
 * Validate price (basic sanity check)
 */
export function isValidPrice(price: number): boolean {
  return price > 0 && price < 1000 && !isNaN(price);
}

/**
 * Extract all services from HTML content
 */
export function extractServicesFromHtml(
  html: string,
  source: string
): ServicePrice[] {
  const services: ServicePrice[] = [];
  
  // Look for common service menu patterns
  const servicePatterns = [
    /<div[^>]*class="[^"]*service[^"]*"[^>]*>(.*?)<\/div>/gi,
    /<tr[^>]*>(.*?)<\/tr>/gi,
    /<li[^>]*>(.*?)<\/li>/gi,
  ];
  
  for (const pattern of servicePatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const content = match[1];
      
      // Try to extract service name and price
      const textPattern = />([^<]+)</g;
      const texts: string[] = [];
      const textMatches = content.matchAll(textPattern);
      
      for (const textMatch of textMatches) {
        if (textMatch[1]?.trim()) {
          texts.push(textMatch[1].trim());
        }
      }
      
      // Analyze texts to find service name and price
      if (texts.length >= 2) {
        const serviceName = texts[0];
        const priceText = texts.find(t => extractPrices(t).length > 0) || texts[1];
        
        const service = parseServiceItem(serviceName, priceText, source);
        if (service && isValidPrice(service.price)) {
          services.push(service);
        }
      }
    }
  }
  
  return services;
}



