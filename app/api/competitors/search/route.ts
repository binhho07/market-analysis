import { NextRequest } from "next/server";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";

const searchSchema = z.object({
  address: z.string().min(5, "Address must be at least 5 characters"),
  radius: z.number().min(1).max(50),
  competitorCount: z.number().min(1).max(50), // Allow up to 50 competitors
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Optional authentication - allow public access but track if authenticated
    let user = null;
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      user = await getUserFromToken(token);
    }

    const body = await request.json();
      
      // Validate input
      const result = searchSchema.safeParse(body);
      if (!result.success) {
        return errorResponse(
          "Validation error",
          400,
          "VALIDATION_ERROR",
          result.error.issues
        );
      }

      const { address, radius, competitorCount, lat, lng } = result.data;

      // If lat/lng not provided, we need to geocode first
      if (!lat || !lng) {
        return errorResponse(
          "Location coordinates required. Please geocode address first.",
          400,
          "MISSING_COORDINATES"
        );
      }

      // Import Google Maps functions and caching
      const { searchNearbyPlaces, calculateDistance } = await import("@/lib/google-maps");
      const { getCachedPlaceDetailsBatch } = await import("@/lib/place-cache");
      
      // Search for real competitors using Google Places API
      const radiusMeters = Math.round(radius * 1609.34); // Convert miles to meters
      const places = await searchNearbyPlaces(
        { lat, lng },
        radiusMeters,
        "nail salon"
      );

      // Fetch detailed info (including website) using cache
      console.log(`📊 Fetching details for ${places.length} places (with caching)...`);
      const placeIds = places.map(p => p.placeId);
      const detailedPlaces = await getCachedPlaceDetailsBatch(placeIds);

      // Calculate distances and add to results
      const placesWithDistance = detailedPlaces.map((place) => {
        const priceLevel = place.priceLevel || 2;
        const priceRange = priceLevel === 1 ? "$" : priceLevel === 2 ? "$$" : priceLevel === 3 ? "$$$" : "$$$$";
        
        return {
          id: place.placeId,
          name: place.name,
          website: place.website || "#",
          address: place.address,
          location: place.location,
          rating: place.rating || 0,
          reviewCount: place.userRatingsTotal || 0,
          priceRange: priceRange,
          distanceMiles: calculateDistance(lat, lng, place.location.lat, place.location.lng),
          // Placeholder prices - will be replaced with scraped prices
          samplePrices: {
            gel: null,
            pedicure: null,
            acrylic: null,
          },
          staffBand: (place.userRatingsTotal || 0) > 200 ? "8+" : (place.userRatingsTotal || 0) > 100 ? "4-7" : "1-3",
          hoursPerWeek: 50 + Math.floor(Math.random() * 30),
          amenities: ["Wi-Fi", "Wheelchair Accessible", "Parking"].slice(0, Math.floor(Math.random() * 3) + 1),
        };
      });

      // Smart sorting algorithm: Balance quality, popularity, and proximity
      // Score formula: (rating/5) × log(reviews + 1) / distance
      // Higher score = better competitor (popular, well-rated, and reasonably close)
      const competitorsWithScore = placesWithDistance.map(comp => {
        const rating = comp.rating || 3.0;
        const reviews = comp.reviewCount || 1;
        const distance = comp.distanceMiles || 0.1;
        
        // Calculate quality score (0-1)
        const ratingScore = rating / 5;
        
        // Calculate popularity score using logarithm (diminishing returns for reviews)
        const popularityScore = Math.log(reviews + 1);
        
        // Calculate proximity score (inverse of distance)
        const proximityScore = 1 / Math.max(distance, 0.1);
        
        // Combined score (weighted)
        const score = (ratingScore * 10) * (popularityScore * 2) * (proximityScore * 0.5);
        
        return {
          ...comp,
          competitiveScore: Math.round(score * 10) / 10
        };
      });

      // Sort by competitive score (highest first), then by distance as tiebreaker
      competitorsWithScore.sort((a, b) => {
        if (Math.abs(a.competitiveScore - b.competitiveScore) > 1) {
          return b.competitiveScore - a.competitiveScore; // Higher score first
        }
        return a.distanceMiles - b.distanceMiles; // Same score? Closer first
      });
      
      const competitors = competitorsWithScore.slice(0, competitorCount);

      // 🔍 STEP 2 & 3: INTELLIGENT WEBSITE DISCOVERY
      console.log(`\n🔍 Step 2-3: Intelligent website discovery pipeline...`);
      const { isBlacklistedDomain } = await import("@/lib/search/domainClassifier");
      const { discoverWebsite } = await import("@/lib/search/websiteDiscovery");
      
      // Check which competitors need discovery
      const needsDiscovery = competitors.filter(comp => {
        if (!comp.website || comp.website === "#") return true;
        if (isBlacklistedDomain(comp.website)) return true;
        return false;
      });
      
      console.log(`🎯 ${needsDiscovery.length}/${competitors.length} competitors need website discovery`);
      
      // Discover websites sequentially with delays
      if (needsDiscovery.length > 0) {
        for (let i = 0; i < needsDiscovery.length; i++) {
          const comp = needsDiscovery[i];
          
          console.log(`\n[${i + 1}/${needsDiscovery.length}] Discovering: ${comp.name}`);
          
          try {
            const discovered = await discoverWebsite(comp.name, comp.address, comp.phone);
            
            if (discovered.success && discovered.homepage) {
              console.log(`✅ Found: ${discovered.homepage} (confidence: ${discovered.confidence}, score: ${discovered.score})`);
              comp.website = discovered.homepage;
              comp.discoveredWebsite = true;
              comp.websiteConfidence = discovered.confidence;
              comp.websiteScore = discovered.score;
              comp.servicesPage = discovered.servicesPage;
              comp.menuPage = discovered.menuPage;
            } else {
              console.log(`❌ Not found: ${discovered.error || 'Unknown error'}`);
              comp.discoveredWebsite = false;
            }
          } catch (error: any) {
            console.error(`❌ Discovery error: ${error.message}`);
            comp.discoveredWebsite = false;
          }
        }
      }

      // 🤖 STEP 4: SMART WEB SCRAPING (Only custom domains)
      console.log(`\n🤖 Step 4: Smart scraping (filtering directories/social media)...`);
      let scrapedPricesMap = new Map();
      
      try {
        const { batchSmartScrape } = await import("@/lib/scraping/scraper");
        
        // Prepare scraping targets (pass all URLs: homepage, services, menu + score)
        const scrapingTargets = competitors
          .filter(comp => comp.website && comp.website !== "#")
          .map(comp => ({
            name: comp.name,
            website: comp.website, // Homepage
            websiteScore: comp.websiteScore || 0,
            servicesPage: comp.servicesPage, // Discovered services page
            menuPage: comp.menuPage // Discovered menu page
          }));
        
        console.log(`🎯 ${scrapingTargets.length} potential targets (will filter)...`);
        
        if (scrapingTargets.length > 0) {
          scrapedPricesMap = await batchSmartScrape(scrapingTargets);
          console.log(`✅ Scraping completed: ${scrapedPricesMap.size} results`);
        } else {
          console.log(`⚠️  No websites to scrape`);
        }
      } catch (scrapingError: any) {
        console.error("❌ Scraping failed:", scrapingError);
        console.error("❌ Error details:", {
          message: scrapingError?.message,
          stack: scrapingError?.stack,
          name: scrapingError?.name
        });
        // Continue without prices
      }
      
      // 📊 STEP 5: SMART FALLBACK & ESTIMATION
      console.log(`\n📊 Step 5: Applying prices (scraped or estimated)...`);
      const { estimatePrices } = await import("@/lib/scraping/scraper");
      
      competitors.forEach(comp => {
        const scrapedData = scrapedPricesMap.get(comp.name);
        
        // Extract price level from priceRange string ($, $$, $$$, $$$$)
        const priceLevelMap: Record<string, number> = { "$": 1, "$$": 2, "$$$": 3, "$$$$": 4 };
        const priceLevel = priceLevelMap[comp.priceRange] || 2;
        
        // Get estimates using centralized function
        const estimates = estimatePrices(priceLevel);

        // Determine source
        let source = 'Estimated (Tier)';
        let gelPrice = estimates.gel;
        let pediPrice = estimates.pedicure;
        let acrylicPrice = estimates.acrylic;

        if (scrapedData) {
          if (scrapedData.source === 'scraped' && scrapedData.success) {
            source = 'Scraped (Real)';
            gelPrice = scrapedData.gel || estimates.gel;
            pediPrice = scrapedData.pedicure || estimates.pedicure;
            acrylicPrice = scrapedData.acrylic || estimates.acrylic;
          } else if (scrapedData.source === 'skipped') {
            source = `Estimated (${scrapedData.reason})`;
          } else {
            source = 'Estimated (Scraping failed)';
          }
        }

        const websiteInfo = comp.discoveredWebsite 
          ? `Discovered (${comp.websiteConfidence}, score: ${comp.websiteScore})`
          : 'From Google Places';

        console.log(`🏷️ ${comp.name}:`, {
          source,
          website: websiteInfo,
          gel: gelPrice,
          pedi: pediPrice,
          acrylic: acrylicPrice
        });

        comp.samplePrices = {
          gel: gelPrice,
          pedicure: pediPrice,
          acrylic: acrylicPrice,
        };
        
        // Add metadata for UI
        comp.priceSource = source.includes('Scraped') ? 'scraped' : 'estimated';
        comp.priceConfidence = comp.websiteConfidence || 'low';
        
        if (scrapedData?.services && scrapedData.services.length > 0) {
          comp.scrapedServices = scrapedData.services.slice(0, 10);
        }
      });

      // Reconnect Prisma after long scraping operation
      try {
        await prisma.$connect();
      } catch (reconnectError) {
        console.error("Prisma reconnect failed:", reconnectError);
      }

      // Save search to database (only if authenticated)
      if (user) {
        try {
          await prisma.savedSearch.create({
            data: {
              userId: user.id,
              searchAddress: address,
              radiusMiles: radius,
              competitorCount: competitors.length,
              results: JSON.parse(JSON.stringify(competitors)), // Convert to JSON
            },
          });
        } catch (dbError) {
          console.error("Failed to save search:", dbError);
          // Continue even if save fails
        }
      }

      // Track API usage (only if authenticated)
      if (user) {
        try {
          await prisma.apiUsage.upsert({
            where: {
              userId_endpoint_date: {
                userId: user.id,
                endpoint: "/api/competitors/search",
                date: new Date(),
              },
            },
            update: {
              requestCount: {
                increment: 1,
              },
            },
            create: {
              userId: user.id,
              endpoint: "/api/competitors/search",
              requestCount: 1,
              date: new Date(),
            },
          });
        } catch (dbError) {
          console.error("Failed to track usage:", dbError);
          // Continue even if tracking fails
        }
      }

      return successResponse({
        competitors,
        searchLocation: { lat, lng },
        meta: {
          searchAddress: address,
          radius,
          count: competitors.length,
          lat,
          lng,
        },
      }, "Competitors found successfully");
  } catch (error) {
    console.error("Search error:", error);
    return errorResponse(
      "Failed to search competitors",
      500,
      "INTERNAL_ERROR"
    );
  }
}



