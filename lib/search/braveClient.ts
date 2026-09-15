/**
 * 🦁 Brave Search API Client
 * Robust client with retry, rate limiting, and caching
 */

import { retry, isRetryableError } from "@/lib/utils/retry";
import { randomDelay, sleepWithJitter } from "@/lib/utils/sleep";
import { isBlacklistedDomain } from "./domainClassifier";

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveApiResponse {
  web?: {
    results: BraveSearchResult[];
  };
}

interface SearchResult {
  url: string;
  title: string;
  description: string;
}

// Simple in-memory cache (24h TTL)
const searchCache = new Map<
  string,
  { results: SearchResult[]; timestamp: number }
>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// API key rotation (support multiple keys to avoid rate limits)
const API_KEYS = [
  process.env.BRAVE_SEARCH_API_KEY,
  process.env.BRAVE_SEARCH_API_KEY_2,
  process.env.BRAVE_SEARCH_API_KEY_3,
].filter(Boolean) as string[];

let currentKeyIndex = 0;

/**
 * Get next API key (rotation on rate limit)
 */
function getNextApiKey(): string | null {
  if (API_KEYS.length === 0) {
    return null;
  }

  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

/**
 * Check if cache is valid
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL;
}

/**
 * Search with Brave API (with retry and rate limiting)
 */
export async function braveSearch(
  query: string,
  options: {
    count?: number;
    useCache?: boolean;
  } = {}
): Promise<SearchResult[]> {
  const { count = 10, useCache = true } = options;

  // Check cache
  if (useCache) {
    const cached = searchCache.get(query);
    if (cached && isCacheValid(cached.timestamp)) {
      console.log(`💾 Cache HIT for query: "${query}"`);
      return cached.results;
    }
  }

  // Add random delay before request (300-1100ms)
  await randomDelay(300, 1100);

  // Retry with exponential backoff
  const results = await retry(
    async () => {
      const apiKey = getNextApiKey();

      if (!apiKey) {
        throw new Error("BRAVE_API_KEY_MISSING");
      }

      console.log(`🔍 Brave Search: "${query}"`);

      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": apiKey,
          },
        }
      );

      if (!response.ok) {
        const error: any = new Error(
          `Brave API error: ${response.status} ${response.statusText}`
        );
        error.status = response.status;
        error.code = response.status === 429 ? "RATE_LIMIT" : "API_ERROR";
        throw error;
      }

      const data: BraveApiResponse = await response.json();

      if (!data.web || data.web.results.length === 0) {
        return [];
      }

      // Filter out blacklisted domains immediately
      const filtered = data.web.results.filter(
        (result) => !isBlacklistedDomain(result.url)
      );

      console.log(
        `✅ Found ${filtered.length}/${data.web.results.length} valid results`
      );

      return filtered.map((result) => ({
        url: result.url,
        title: result.title,
        description: result.description,
      }));
    },
    {
      maxAttempts: 3,
      baseDelay: 2000, // 2 seconds
      maxDelay: 10000, // 10 seconds max
      shouldRetry: (error) => {
        // Retry on rate limits and network errors
        if (error.status === 429) {
          console.log(`🚦 Rate limit (429), rotating API key...`);
          // Rotate to next key
          getNextApiKey();
          return true;
        }
        return isRetryableError(error);
      },
      onRetry: (attempt, error) => {
        console.log(`⏳ Retry ${attempt}/3 after error: ${error.message}`);
      },
    }
  );

  // Cache results
  if (useCache && results.length > 0) {
    searchCache.set(query, {
      results,
      timestamp: Date.now(),
    });
    console.log(`💾 Cached results for: "${query}"`);
  }

  return results;
}

/**
 * Multi-query search strategy
 * Try multiple queries until we find a real website
 */
export async function multiQuerySearch(
  businessName: string,
  address: string,
  city?: string
): Promise<SearchResult[]> {
  // Extract city from address if not provided
  const extractedCity =
    city || address.split(",").slice(-2)[0]?.trim() || "";

  // Query strategies (in order of priority)
  const queries = [
    `${businessName} ${address} official website`,
    `${businessName} ${extractedCity} nail salon`,
    `${businessName} ${extractedCity} services`,
    `${businessName} manicure pedicure pricing`,
  ];

  console.log(`\n🎯 Multi-query search for: ${businessName}`);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    try {
      console.log(`   Query ${i + 1}/${queries.length}: "${query}"`);

      const results = await braveSearch(query, { count: 5 });

      if (results.length > 0) {
        console.log(`   ✅ Found ${results.length} results`);
        return results;
      }

      console.log(`   ⚠️  No results, trying next query...`);

      // Add delay between queries
      if (i < queries.length - 1) {
        await sleepWithJitter(1000, 200); // 1s + jitter
      }
    } catch (error: any) {
      console.error(`   ❌ Query failed: ${error.message}`);

      // If rate limited, stop trying
      if (error.status === 429 || error.code === "RATE_LIMIT") {
        console.log(`   🚦 Rate limited, stopping search`);
        break;
      }

      // Otherwise continue to next query
      if (i < queries.length - 1) {
        await sleepWithJitter(2000, 500); // Longer delay after error
      }
    }
  }

  return [];
}

/**
 * Clear cache (useful for testing)
 */
export function clearSearchCache(): void {
  searchCache.clear();
  console.log("🗑️  Search cache cleared");
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: searchCache.size,
    keys: Array.from(searchCache.keys()),
  };
}

