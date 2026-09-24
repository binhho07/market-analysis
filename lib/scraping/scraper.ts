/**
 * 🤖 Smart Scraper with Fallback
 * Only scrapes real custom domains, skips directories/social media
 */

import { isBlacklistedDomain } from "@/lib/search/domainClassifier";
import { batchScrapeWithCheerio } from "./cheerio-scraper";
import { scrapeWithFallback } from "./engine";

export interface ScraperResult {
  success: boolean;
  gel?: number;
  pedicure?: number;
  acrylic?: number;
  services?: Array<{ name: string; price: number }>;
  source: "scraped" | "estimated" | "skipped";
  reason?: string;
}

/**
 * Smart scrape decision: ULTRA STRICT - Only scrape validated real business websites
 */
export function shouldScrape(url: string, websiteScore?: number): {
  shouldScrape: boolean;
  reason: string;
} {
  if (!url || url === "#") {
    return {
      shouldScrape: false,
      reason: "No URL provided",
    };
  }

  // HARD BLOCK: Check blocked domains
  if (isBlacklistedDomain(url)) {
    console.log(`   ⚠️  Blocked directory domain - skipping scrape`);
    return {
      shouldScrape: false,
      reason: "Blocked domain (directory/social media/review site)",
    };
  }

  // STRICT: Only scrape if website was validated with score >= 20
  if (websiteScore !== undefined && websiteScore < 20) {
    console.log(`   ❌ Invalid website (score: ${websiteScore} < 20) - skipping scrape`);
    return {
      shouldScrape: false,
      reason: `Invalid website (score: ${websiteScore} < 20)`,
    };
  }

  return {
    shouldScrape: true,
    reason: "Valid custom domain (score >= 20)",
  };
}

/**
 * Scrape a single website (with ULTRA STRICT filtering)
 */
export async function smartScrape(
  name: string,
  url: string,
  websiteScore?: number
): Promise<ScraperResult> {
  // ULTRA STRICT: Check if we should scrape
  const decision = shouldScrape(url, websiteScore);

  if (!decision.shouldScrape) {
    console.log(`⏭️  Skipping scrape for ${name}: ${decision.reason}`);
    return {
      success: false,
      source: "skipped",
      reason: decision.reason,
    };
  }

  // Only scrape validated custom domains
  console.log(`🌐 Scraping ${name}: ${url} (validated, score: ${websiteScore || 'unknown'})`);

  try {
    const result = await scrapeWithFallback(name, url);

    if (result.success) {
      console.log(`✅ Scraped ${name} via ${result.engine}`);
      return {
        success: true,
        gel: result.gel,
        pedicure: result.pedicure,
        acrylic: result.acrylic,
        services: result.services,
        source: "scraped",
        reason: result.engine,
      };
    }

    console.log(`⚠️  Scraping failed for ${name} after ${result.engine}`);
    return {
      success: false,
      source: "estimated",
      reason: result.engine === "puppeteer" ? "Browser fallback found no prices" : "Scraping failed - content not extractable",
    };
  } catch (error: any) {
    console.error(`❌ Scraping error for ${name}: ${error.message}`);
    return {
      success: false,
      source: "estimated",
      reason: `Scraping error: ${error.message}`,
    };
  }
}

/**
 * Batch scrape with ULTRA STRICT filtering + Service Page Priority
 */
export async function batchSmartScrape(
  targets: Array<{
    name: string;
    website: string;
    websiteScore?: number;
    servicesPage?: string;
    menuPage?: string;
  }>
): Promise<Map<string, ScraperResult>> {
  const results = new Map<string, ScraperResult>();

  // ULTRA STRICT: Filter targets - only scrape validated domains with score >= 20
  const scrapableTargets = targets.filter((target) =>
    shouldScrape(target.website, target.websiteScore).shouldScrape
  );

  const skippedTargets = targets.filter(
    (target) => !shouldScrape(target.website, target.websiteScore).shouldScrape
  );

  console.log(
    `\n🤖 ULTRA STRICT Scraper: ${scrapableTargets.length} validated, ${skippedTargets.length} rejected/blocked`
  );

  // Mark skipped targets
  for (const target of skippedTargets) {
    const decision = shouldScrape(target.website, target.websiteScore);
    console.log(`⏭️  ${target.name}: ${decision.reason}`);

    results.set(target.name, {
      success: false,
      source: "skipped",
      reason: decision.reason,
    });
  }

  // Scrape only validated targets (PRIORITIZE SERVICE PAGES)
  if (scrapableTargets.length > 0) {
    // CRITICAL: Use servicesPage or menuPage if available, fallback to homepage
    const scrapingTargets = scrapableTargets.map((target) => {
      // Priority: servicesPage > menuPage > homepage
      const scrapeUrl =
        target.servicesPage ||
        target.menuPage ||
        target.website;

      const pageType = target.servicesPage
        ? "services page"
        : target.menuPage
        ? "menu page"
        : "homepage";

      console.log(
        `   📄 ${target.name}: Scraping ${pageType} → ${scrapeUrl}`
      );

      return {
        name: target.name,
        website: scrapeUrl,
      };
    });

    try {
      const scrapedData = await batchScrapeWithCheerio(scrapingTargets, 2);

      for (const target of scrapableTargets) {
        const result = scrapedData.get(target.name);

        if (result && result.success) {
          results.set(target.name, {
            success: true,
            gel: result.gel,
            pedicure: result.pedicure,
            acrylic: result.acrylic,
            services: result.services,
            source: "scraped",
          });
        } else {
          results.set(target.name, {
            success: false,
            source: "estimated",
            reason: "Content not extractable",
          });
        }
      }
    } catch (error: any) {
      console.error(`❌ Batch scraping error: ${error.message}`);

      // Mark all as failed (fallback to estimation)
      for (const target of scrapableTargets) {
        if (!results.has(target.name)) {
          results.set(target.name, {
            success: false,
            source: "estimated",
            reason: `Scraping error: ${error.message}`,
          });
        }
      }
    }
  }

  return results;
}

export async function scrapWithPuppeteer(url: string): Promise<ScraperResult> {
  if (process.env.VERCEL === "1") {
    return {
      success: false,
      source: "skipped",
      reason: "Browser scrape runs on the scrape worker, not in the web process",
    };
  }
  const result = await scrapeWithFallback(url, url);
  return {
    success: result.success,
    gel: result.gel,
    pedicure: result.pedicure,
    acrylic: result.acrylic,
    services: result.services,
    source: result.success ? "scraped" : "estimated",
    reason: result.engine,
  };
}

/**
 * Estimate prices based on price tier
 */
export function estimatePrices(priceLevel: number): {
  gel: number;
  pedicure: number;
  acrylic: number;
} {
  const estimates: Record<
    number,
    { gel: number; pedicure: number; acrylic: number }
  > = {
    1: { gel: 30, pedicure: 35, acrylic: 45 },
    2: { gel: 40, pedicure: 45, acrylic: 55 },
    3: { gel: 50, pedicure: 60, acrylic: 70 },
    4: { gel: 65, pedicure: 80, acrylic: 90 },
  };

  return estimates[priceLevel] || estimates[2];
}

