/**
 * Lightweight scraper using Cheerio (no browser needed)
 * Works on Vercel and local environments
 */

import * as cheerio from "cheerio";
import https from "https";
import http from "http";
import { retryWithExponentialBackoff } from "@/lib/utils/retry";

// User-Agent rotation pool
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
];

let userAgentIndex = 0;

// Rotate user-agent
function getNextUserAgent(): string {
  const ua = USER_AGENTS[userAgentIndex];
  userAgentIndex = (userAgentIndex + 1) % USER_AGENTS.length;
  return ua;
}

export interface ScrapedService {
  name: string;
  price: number;
  priceRange?: string;
}

export interface ScrapeResult {
  success: boolean;
  services: ScrapedService[];
  gel?: number;
  pedicure?: number;
  acrylic?: number;
  source: string;
  confidence: number;
}

/**
 * Fetch HTML with retry, exponential backoff, and user-agent rotation
 */
async function fetchHTMLWithRetry(
  url: string,
  attemptNumber: number = 1
): Promise<string> {
  const userAgent = getNextUserAgent();
  
  console.log(`   🔄 Fetch attempt ${attemptNumber}/3 (UA: ${userAgent.substring(0, 50)}...)`);

  return retryWithExponentialBackoff(
    async () => {
      return await fetchHTMLInternal(url, userAgent);
    },
    3, // 3 retries
    300 // Start at 300ms, then 800ms, then 1500ms
  );
}

/**
 * Internal fetch function with redirect loop detection
 */
async function fetchHTMLInternal(
  url: string,
  userAgent: string,
  redirectCount: number = 0,
  visitedUrls: Set<string> = new Set()
): Promise<string> {
  // Prevent infinite redirect loops
  if (redirectCount > 5) {
    throw new Error("Too many redirects (>5)");
  }

  // Detect redirect loops
  if (visitedUrls.has(url)) {
    throw new Error("Redirect loop detected");
  }

  visitedUrls.add(url);

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    const requestOptions = {
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Ch-Ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Referer": "https://www.google.com/",
      },
      timeout: 10000, // 10s timeout
    };

    const req = protocol.get(url, requestOptions, (res) => {
      // Handle redirects with loop detection
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const redirectUrl = new URL(res.headers.location, url).href;
        console.log(`   ↪️ Redirecting to: ${redirectUrl}`);
        fetchHTMLInternal(redirectUrl, userAgent, redirectCount + 1, visitedUrls)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout (10s)"));
    });
  });
}

/**
 * Extract prices from text with improved regex
 */
function extractPrices(text: string): number[] {
  const prices: number[] = [];
  
  // Enhanced regex for various price formats
  // Matches: $25, $25.00, 25$, $ 25, 25 USD, etc.
  const patterns = [
    /\$\s*(\d+(?:\.\d{2})?)/g,           // $25, $ 25
    /(\d+(?:\.\d{2})?)\s*\$/g,           // 25$
    /(?:USD|Price|Cost)[:\s]*(\d+(?:\.\d{2})?)/gi, // USD 25, Price: 25
    /starting\s+at\s*\$?\s*(\d+)/gi,     // starting at $25
    /from\s*\$?\s*(\d+)/gi               // from $25
  ];

  patterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const price = parseFloat(match[1]);
      // Filter unreasonable prices (too low or too high for nails)
      // Avoid capturing years (2023) or phone numbers
      if (price >= 15 && price <= 200) { 
        prices.push(price);
      }
    }
  });

  return prices;
}

/**
 * Categorize service by name
 */
function categorizeService(name: string): string | null {
  const lower = name.toLowerCase();
  
  if ((lower.includes('gel') || lower.includes('shellac') || lower.includes('no-chip')) && 
      (lower.includes('mani') || lower.includes('polish') || lower.includes('color'))) {
    return 'gel';
  }
  if (lower.includes('pedicure') || lower.includes('pedi') || lower.includes('spa') && lower.includes('feet')) {
    return 'pedicure';
  }
  if (lower.includes('acrylic') || lower.includes('full set') || lower.includes('fill') || lower.includes('artificial')) {
    return 'acrylic';
  }
  if (lower.includes('dip') || lower.includes('powder') || lower.includes('sns')) {
    return 'dip';
  }
  
  return null;
}

/**
 * Parse services from HTML
 */
function parseServices(html: string): ScrapedService[] {
  const $ = cheerio.load(html);
  const services: ScrapedService[] = [];
  
  // Remove scripts, styles, and navigation to reduce noise
  $('script, style, nav, footer, header, meta, link').remove();

  // Strategy 1: Look for table rows (common in price lists)
  $('tr').each((_, elem) => {
    const $row = $(elem);
    const text = $row.text().replace(/\s+/g, ' ').trim();
    
    const prices = extractPrices(text);
    if (prices.length > 0) {
      // Try to get name from first cell
      const name = $row.find('td, th').first().text().trim();
      if (name && name.length > 3 && name.length < 100 && !/\d/.test(name)) {
        services.push({ name, price: prices[0] });
      }
    }
  });

  // Strategy 2: Look for list items with nail keywords
  $('li').each((_, elem) => {
    const text = $(elem).text().replace(/\s+/g, ' ').trim();
    const textLower = text.toLowerCase();
    
    // IMPROVED: Must contain nail-related keywords
    const nailKeywords = ['manicure', 'pedicure', 'gel', 'acrylic', 'nail', 'nails', 'polish', 'dip', 'powder'];
    const hasNailKeyword = nailKeywords.some(kw => textLower.includes(kw));
    
    const prices = extractPrices(text);
    if (prices.length > 0 && hasNailKeyword) {
      const name = text.replace(/[\$\d.,]+.*/, '').trim(); // Remove price part
      if (name.length > 3 && name.length < 100) {
        services.push({ name, price: prices[0] });
      }
    }
  });

  // Strategy 3: Look for h1-h6 and div/p/span with price patterns + nail keywords
  $('h1, h2, h3, h4, h5, h6, div, p, span').each((_, elem) => {
    // Only check leaf nodes or nodes with minimal children
    if ($(elem).children().length > 2) return;

    const text = $(elem).text().replace(/\s+/g, ' ').trim();
    const textLower = text.toLowerCase();
    
    // IMPROVED: Must contain nail-related keywords
    const nailKeywords = ['manicure', 'pedicure', 'gel', 'acrylic', 'nail', 'nails', 'polish', 'dip', 'powder', 'spa'];
    const hasNailKeyword = nailKeywords.some(kw => textLower.includes(kw));
    
    const prices = extractPrices(text);
    
    if (prices.length > 0 && hasNailKeyword) {
      // Try to find name in the same element or previous sibling
      let name = text.replace(/[\$\d.,]+.*/, '').trim();
      
      if (name.length < 3) {
        // Check previous element
        const prev = $(elem).prev().text().trim();
        if (prev.length > 3 && prev.length < 100) name = prev;
      }

      if (name.length > 3 && name.length < 100) {
        services.push({ name, price: prices[0] });
      }
    }
  });

  return services;
}

/**
 * Main scraping function
 */
export async function scrapeWithCheerio(
  url: string,
  competitorName: string
): Promise<ScrapeResult> {
  console.log(`\n🌐 Cheerio Scraper: ${competitorName}`);
  console.log(`   URL: ${url}`);

  const result: ScrapeResult = {
    success: false,
    services: [],
    source: url,
    confidence: 0,
  };

  if (!url || url === '#' || url.includes('google.com')) {
    console.log(`   ⚠️ Invalid URL: ${url}`);
    return result;
  }

  try {
    // Fetch HTML with retry and user-agent rotation
    const html = await fetchHTMLWithRetry(url);
    console.log(`   ✅ Fetched ${html.length} bytes`);

    // CRITICAL: Check if page is too small (JS-only or empty)
    if (html.length < 5000) {
      console.log(`   ⚠️  Page too small (${html.length} < 5000) - likely JS-only site`);
      return result;
    }

    // CRITICAL: Reject directory pages even after fetching
    const htmlLower = html.toLowerCase();
    const directoryKeywords = [
      "directory",
      "find businesses",
      "business listings",
      "review site",
      "sponsored listing",
    ];

    for (const keyword of directoryKeywords) {
      if (htmlLower.includes(keyword)) {
        console.log(`   ❌ Rejected: Contains "${keyword}" - directory page`);
        return result;
      }
    }

    // Parse services
    const services = parseServices(html);
    console.log(`   📋 Found ${services.length} potential services`);

    if (services.length === 0) {
      console.log(`   ❌ No services extracted`);
      return result;
    }

    result.services = services;
    result.success = true;

    // Categorize services and find median prices
    const gelPrices: number[] = [];
    const pediPrices: number[] = [];
    const acrylicPrices: number[] = [];

    services.forEach(service => {
      const category = categorizeService(service.name);
      if (category === 'gel') gelPrices.push(service.price);
      if (category === 'pedicure') pediPrices.push(service.price);
      if (category === 'acrylic') acrylicPrices.push(service.price);
    });

    // Helper to get median
    const getMedian = (arr: number[]) => {
      if (arr.length === 0) return undefined;
      const sorted = arr.sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };

    result.gel = getMedian(gelPrices);
    result.pedicure = getMedian(pediPrices);
    result.acrylic = getMedian(acrylicPrices);

    // Calculate confidence
    const hasGel = !!result.gel;
    const hasPedicure = !!result.pedicure;
    const hasAcrylic = !!result.acrylic;
    result.confidence = ((hasGel ? 1 : 0) + (hasPedicure ? 1 : 0) + (hasAcrylic ? 1 : 0)) / 3;

    console.log(`   ✅ Gel: ${result.gel ? `$${result.gel}` : 'N/A'}`);
    console.log(`   ✅ Pedicure: ${result.pedicure ? `$${result.pedicure}` : 'N/A'}`);
    console.log(`   ✅ Acrylic: ${result.acrylic ? `$${result.acrylic}` : 'N/A'}`);
    console.log(`   ✅ Confidence: ${(result.confidence * 100).toFixed(0)}%`);

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  return result;
}

/**
 * Batch scrape multiple competitors
 */
export async function batchScrapeWithCheerio(
  competitors: Array<{ name: string; website: string }>,
  concurrency: number = 2
): Promise<Map<string, ScrapeResult>> {
  const results = new Map<string, ScrapeResult>();

  console.log(`\n🚀 Batch scraping ${competitors.length} competitors (Cheerio mode)`);

  for (let i = 0; i < competitors.length; i += concurrency) {
    const batch = competitors.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(comp => 
        scrapeWithCheerio(comp.website, comp.name)
          .catch(error => ({
            success: false,
            services: [],
            source: comp.website,
            confidence: 0,
          } as ScrapeResult))
      )
    );

    batch.forEach((comp, idx) => {
      results.set(comp.name, batchResults[idx]);
    });

    // Rate limiting
    if (i + concurrency < competitors.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const successful = Array.from(results.values()).filter(r => r.success).length;
  console.log(`\n✅ Batch complete: ${successful}/${competitors.length} successful`);

  return results;
}
