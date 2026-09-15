import { geocodeAddress, searchNearbyPlaces, getPlaceDetails } from "../google-maps";
import { getBrowser, createPage, navigateToUrl, takeScreenshot, extractText, extractTexts } from "../scraping/browser";
import { extractServicesFromHtml, ServicePrice } from "../scraping/price-extractor";
import { prisma } from "../prisma";
import * as cheerio from "cheerio";

export interface TargetLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number; // in meters
}

export interface CrawlOptions {
  deepCrawl?: boolean;
  takeScreenshots?: boolean;
  includeReviews?: boolean;
  includeSocialMedia?: boolean;
  includeSeoAnalysis?: boolean;
}

export interface CompetitorData {
  // Basic info
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  website?: string;
  
  // Business details
  openingHours?: string[];
  services?: ServicePrice[];
  priceLevel?: number;
  
  // Ratings & reviews
  googleRating?: number;
  googleReviewCount?: number;
  facebookRating?: number;
  facebookReviewCount?: number;
  yelpRating?: number;
  yelpReviewCount?: number;
  
  // Social media
  facebookUrl?: string;
  instagramUrl?: string;
  yelpUrl?: string;
  
  // SEO & Technical
  seoTitle?: string;
  seoDescription?: string;
  h1Tag?: string;
  statusCode?: number;
  pageLoadTime?: number;
  
  // Crawl metadata
  crawlTimestamp: Date;
  crawlStatus: "success" | "partial" | "failed";
  crawlErrors?: string[];
  screenshotPath?: string;
  sourceUrl?: string;
}

export interface CrawlResults {
  competitors: CompetitorData[];
  processed: number;
  errors: number;
  totalTime: number;
}

/**
 * Main competitor crawling function
 */
export async function crawlCompetitors(
  targetLocation: TargetLocation,
  options: CrawlOptions = {}
): Promise<CrawlResults> {
  const startTime = Date.now();
  const results: CompetitorData[] = [];
  let processed = 0;
  let errors = 0;

  console.log(`🔍 Starting competitor crawl for ${targetLocation.name}`);
  console.log(`📍 Location: ${targetLocation.address}`);
  console.log(`📏 Radius: ${targetLocation.radius}m`);

  try {
    // Step 1: Find competitors using Google Places API
    const competitors = await findCompetitors(targetLocation);
    console.log(`🎯 Found ${competitors.length} potential competitors`);

    // Step 2: Process each competitor
    for (const competitor of competitors) {
      try {
        console.log(`🏪 Processing: ${competitor.name}`);
        
        const competitorData = await processCompetitor(competitor, options);
        if (competitorData) {
          results.push(competitorData);
          
          // Save to database
          await saveCompetitorData(competitorData);
        }
        
        processed++;
        
        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Failed to process ${competitor.name}:`, error);
        errors++;
        
        // Still save basic competitor info even if crawl failed
        const basicData: CompetitorData = {
          name: competitor.name,
          address: competitor.address,
          lat: competitor.location.lat,
          lng: competitor.location.lng,
          crawlTimestamp: new Date(),
          crawlStatus: "failed",
          crawlErrors: [error instanceof Error ? error.message : "Unknown error"]
        };
        
        await saveCompetitorData(basicData);
      }
    }

  } catch (error) {
    console.error("❌ Crawl failed:", error);
    throw error;
  } finally {
    // Close browser if it was opened
    try {
      const { closeBrowser } = await import("../scraping/browser");
      await closeBrowser();
    } catch (error) {
      console.error("Failed to close browser:", error);
    }
  }

  const totalTime = Date.now() - startTime;
  
  return {
    competitors: results,
    processed,
    errors,
    totalTime
  };
}

/**
 * Find competitors using Google Places API
 */
async function findCompetitors(targetLocation: TargetLocation): Promise<any[]> {
  const keywords = [
    "nail salon",
    "nail spa", 
    "beauty salon",
    "nail technician",
    "manicure pedicure"
  ];
  
  const allCompetitors: any[] = [];
  
  for (const keyword of keywords) {
    try {
      const places = await searchNearbyPlaces(
        { lat: targetLocation.lat, lng: targetLocation.lng },
        targetLocation.radius,
        keyword
      );
      
      // Filter out the target location itself
      const filtered = places.filter(place => 
        !place.name.toLowerCase().includes(targetLocation.name.toLowerCase()) &&
        place.businessStatus === "OPERATIONAL"
      );
      
      allCompetitors.push(...filtered);
      
    } catch (error) {
      console.error(`Failed to search for "${keyword}":`, error);
    }
  }
  
  // Remove duplicates based on place_id
  const uniqueCompetitors = allCompetitors.filter((competitor, index, self) =>
    index === self.findIndex(c => c.placeId === competitor.placeId)
  );
  
  return uniqueCompetitors;
}

/**
 * Process a single competitor
 */
async function processCompetitor(competitor: any, options: CrawlOptions): Promise<CompetitorData | null> {
  console.log(`📊 Processing competitor: ${competitor.name}`);
  
  // Get detailed place information
  const placeDetails = await getPlaceDetails(competitor.placeId);
  if (!placeDetails) {
    throw new Error("Failed to get place details");
  }
  
  const competitorData: CompetitorData = {
    name: placeDetails.name,
    address: placeDetails.address,
    lat: placeDetails.location.lat,
    lng: placeDetails.location.lng,
    phone: placeDetails.phoneNumber,
    website: placeDetails.website,
    openingHours: placeDetails.openingHours?.weekdayText,
    googleRating: placeDetails.rating,
    googleReviewCount: placeDetails.userRatingsTotal,
    priceLevel: placeDetails.priceLevel,
    crawlTimestamp: new Date(),
    crawlStatus: "success",
    crawlErrors: []
  };

  // Deep crawl if enabled
  if (options.deepCrawl && placeDetails.website) {
    try {
      console.log(`🌐 Deep crawling website: ${placeDetails.website}`);
      
      const websiteData = await crawlWebsite(placeDetails.website, options);
      
      // Merge website data
      Object.assign(competitorData, websiteData);
      
    } catch (error) {
      console.error(`Failed to crawl website ${placeDetails.website}:`, error);
      competitorData.crawlStatus = "partial";
      competitorData.crawlErrors = competitorData.crawlErrors || [];
      competitorData.crawlErrors.push(`Website crawl failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Search for social media profiles
  if (options.includeSocialMedia) {
    try {
      const socialMediaData = await findSocialMediaProfiles(competitor.name, competitor.address);
      Object.assign(competitorData, socialMediaData);
    } catch (error) {
      console.error(`Failed to find social media for ${competitor.name}:`, error);
    }
  }

  return competitorData;
}

/**
 * Crawl competitor website
 */
async function crawlWebsite(url: string, options: CrawlOptions): Promise<Partial<CompetitorData>> {
  const page = await createPage();
  const startTime = Date.now();
  
  try {
    // Navigate to website
    const success = await navigateToUrl(page, url);
    if (!success) {
      throw new Error("Failed to navigate to website");
    }

    const websiteData: Partial<CompetitorData> = {
      sourceUrl: url,
      statusCode: 200, // Assume success if we got here
      pageLoadTime: Date.now() - startTime
    };

    // Take screenshot if requested
    if (options.takeScreenshots) {
      const screenshotPath = `screenshots/competitors/${Date.now()}-${url.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      await takeScreenshot(page, screenshotPath);
      websiteData.screenshotPath = screenshotPath;
    }

    // Get page content
    const content = await page.content();
    const $ = cheerio.load(content);

    // Extract SEO data
    websiteData.seoTitle = $("title").text().trim();
    websiteData.seoDescription = $('meta[name="description"]').attr("content") || "";
    websiteData.h1Tag = $("h1").first().text().trim();

    // Extract email
    const emailMatch = content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      websiteData.email = emailMatch[0];
    }

    // Extract services and pricing
    const services = extractServicesFromHtml(content, url);
    if (services.length > 0) {
      websiteData.services = services;
    }

    // Extract phone number if not already found
    if (!websiteData.phone) {
      const phoneMatch = content.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
      if (phoneMatch) {
        websiteData.phone = phoneMatch[0];
      }
    }

    // Look for booking links
    const bookingSelectors = [
      'a[href*="book"]',
      'a[href*="appointment"]',
      'a[href*="reservation"]',
      'a[href*="schedule"]'
    ];
    
    for (const selector of bookingSelectors) {
      const bookingLink = $(selector).attr("href");
      if (bookingLink) {
        websiteData.sourceUrl = bookingLink.startsWith("http") ? bookingLink : new URL(bookingLink, url).href;
        break;
      }
    }

    return websiteData;

  } finally {
    await page.close();
  }
}

/**
 * Find social media profiles for a competitor
 */
async function findSocialMediaProfiles(name: string, address: string): Promise<Partial<CompetitorData>> {
  const socialData: Partial<CompetitorData> = {};
  
  // This would typically involve searching Google, Facebook Graph API, etc.
  // For now, we'll implement basic search patterns
  
  try {
    // Search for Facebook page
    const facebookSearchQuery = `${name} ${address} site:facebook.com`;
    // In a real implementation, you would use Google Custom Search API or Facebook Graph API
    
    // Search for Instagram
    const instagramSearchQuery = `${name} ${address} site:instagram.com`;
    
    // Search for Yelp
    const yelpSearchQuery = `${name} ${address} site:yelp.com`;
    
    // For demo purposes, we'll return empty data
    // In production, implement actual social media discovery
    
  } catch (error) {
    console.error("Social media search failed:", error);
  }
  
  return socialData;
}

/**
 * Save competitor data to database
 */
async function saveCompetitorData(data: CompetitorData): Promise<void> {
  try {
    // Check if competitor already exists
    const existing = await prisma.competitor.findFirst({
      where: {
        name: data.name,
        address: data.address
      }
    });

    if (existing) {
      // Update existing competitor
      await prisma.competitor.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          address: data.address,
          latitude: data.lat,
          longitude: data.lng,
          phone: data.phone,
          email: data.email,
          website: data.website,
          googleRating: data.googleRating,
          googleReviewCount: data.googleReviewCount,
          facebookRating: data.facebookRating,
          facebookReviewCount: data.facebookReviewCount,
          yelpRating: data.yelpRating,
          yelpReviewCount: data.yelpReviewCount,
          facebookUrl: data.facebookUrl,
          instagramUrl: data.instagramUrl,
          yelpUrl: data.yelpUrl,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          h1Tag: data.h1Tag,
          statusCode: data.statusCode,
          pageLoadTime: data.pageLoadTime,
          lastCrawled: data.crawlTimestamp,
          crawlStatus: data.crawlStatus,
          crawlErrors: data.crawlErrors,
          screenshotPath: data.screenshotPath
        }
      });

      // Save crawl history
      await prisma.crawlHistory.create({
        data: {
          competitorId: existing.id,
          crawlTimestamp: data.crawlTimestamp,
          status: data.crawlStatus,
          errors: data.crawlErrors,
          screenshotPath: data.screenshotPath,
          sourceUrl: data.sourceUrl
        }
      });

    } else {
      // Create new competitor
      const newCompetitor = await prisma.competitor.create({
        data: {
          name: data.name,
          address: data.address,
          latitude: data.lat,
          longitude: data.lng,
          phone: data.phone,
          email: data.email,
          website: data.website,
          googleRating: data.googleRating,
          googleReviewCount: data.googleReviewCount,
          facebookRating: data.facebookRating,
          facebookReviewCount: data.facebookReviewCount,
          yelpRating: data.yelpRating,
          yelpReviewCount: data.yelpReviewCount,
          facebookUrl: data.facebookUrl,
          instagramUrl: data.instagramUrl,
          yelpUrl: data.yelpUrl,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          h1Tag: data.h1Tag,
          statusCode: data.statusCode,
          pageLoadTime: data.pageLoadTime,
          lastCrawled: data.crawlTimestamp,
          crawlStatus: data.crawlStatus,
          crawlErrors: data.crawlErrors,
          screenshotPath: data.screenshotPath
        }
      });

      // Save crawl history
      await prisma.crawlHistory.create({
        data: {
          competitorId: newCompetitor.id,
          crawlTimestamp: data.crawlTimestamp,
          status: data.crawlStatus,
          errors: data.crawlErrors,
          screenshotPath: data.screenshotPath,
          sourceUrl: data.sourceUrl
        }
      });

      // Save services if available
      if (data.services && data.services.length > 0) {
        for (const service of data.services) {
          await prisma.service.create({
            data: {
              competitorId: newCompetitor.id,
              name: service.serviceName,
              serviceType: service.serviceType,
              price: service.price,
              priceMin: service.priceRange?.min,
              priceMax: service.priceRange?.max,
              durationMinutes: service.duration,
              confidence: service.confidence,
              source: service.source,
              lastUpdated: data.crawlTimestamp
            }
          });
        }
      }

      // Save opening hours if available
      if (data.openingHours && data.openingHours.length > 0) {
        for (const hours of data.openingHours) {
          await prisma.openingHours.create({
            data: {
              competitorId: newCompetitor.id,
              dayOfWeek: extractDayOfWeek(hours),
              hours: hours,
              lastUpdated: data.crawlTimestamp
            }
          });
        }
      }
    }

  } catch (error) {
    console.error("Failed to save competitor data:", error);
    throw error;
  }
}

/**
 * Extract day of week from hours string
 */
function extractDayOfWeek(hours: string): string {
  const dayPattern = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i;
  const match = hours.match(dayPattern);
  return match ? match[1].toLowerCase() : "unknown";
}
