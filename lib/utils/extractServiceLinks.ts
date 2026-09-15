/**
 * 🔗 Service Link Extractor
 * Finds internal service/pricing/menu links from HTML
 */

/**
 * Extract internal service links from HTML
 */
export function extractServiceLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];

  // Service-related keywords to look for in links
  const serviceKeywords = [
    "service",
    "services",
    "menu",
    "price",
    "pricing",
    "prices",
    "price-list",
    "nail",
    "nails",
    "manicure",
    "pedicure",
  ];

  try {
    const base = new URL(baseUrl);

    // Extract all href attributes
    const hrefPattern = /href=["']([^"']+)["']/gi;
    let match;

    while ((match = hrefPattern.exec(html)) !== null) {
      const href = match[1];

      // Skip external links, anchors, javascript, mailto, tel
      if (
        href.startsWith("http") &&
        !href.includes(base.hostname)
      ) {
        continue;
      }

      if (
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        continue;
      }

      // Check if href contains service keywords
      const hrefLower = href.toLowerCase();
      const hasServiceKeyword = serviceKeywords.some((keyword) =>
        hrefLower.includes(keyword)
      );

      if (hasServiceKeyword) {
        try {
          // Build absolute URL
          const absoluteUrl = new URL(href, baseUrl).href;
          links.push(absoluteUrl);
        } catch {
          // Invalid URL, skip
        }
      }
    }

    // Remove duplicates and return
    return Array.from(new Set(links));
  } catch (error: any) {
    console.error(`   ❌ Error extracting links: ${error.message}`);
    return [];
  }
}

/**
 * Find best service page from extracted links
 */
export function selectBestServicePage(links: string[]): string | null {
  if (links.length === 0) return null;

  // Priority order for service pages
  const priorities = [
    "services",
    "pricing",
    "price-list",
    "menu",
    "nails",
    "manicure",
    "service",
  ];

  // Try each priority keyword
  for (const keyword of priorities) {
    const match = links.find((link) =>
      link.toLowerCase().includes(keyword)
    );
    if (match) {
      return match;
    }
  }

  // Return first link if no priority match
  return links[0];
}

/**
 * Check if page is likely JS-only (too small)
 */
export function isLikelyJsOnlyPage(html: string): boolean {
  // If HTML is very small (<5000 chars), likely a JS-only page
  return html.length < 5000;
}

/**
 * Check if page contains directory/review patterns
 */
export function containsDirectoryPatterns(html: string): boolean {
  const htmlLower = html.toLowerCase();

  const directoryPatterns = [
    "directory",
    "find businesses",
    "business listings",
    "review site",
    "write a review",
    "sponsored listing",
    "business directory",
  ];

  return directoryPatterns.some((pattern) => htmlLower.includes(pattern));
}

