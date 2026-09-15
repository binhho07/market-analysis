/**
 * 🌐 HTML Fetcher
 * Fetches HTML content with proper headers and timeout
 */

export interface FetchHtmlOptions {
  timeout?: number;
  followRedirects?: boolean;
  maxRetries?: number;
}

/**
 * Fetch HTML content from a URL
 */
export async function fetchHtml(
  url: string,
  options: FetchHtmlOptions = {}
): Promise<string | null> {
  const {
    timeout = 10000,
    followRedirects = true,
    maxRetries = 2,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate",
        },
        redirect: followRedirects ? "follow" : "manual",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(
          `   ⚠️  HTTP ${response.status} for ${url}`
        );
        return null;
      }

      const html = await response.text();
      return html;
    } catch (error: any) {
      console.log(
        `   ⚠️  Fetch attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}`
      );

      if (attempt === maxRetries) {
        return null;
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return null;
}

/**
 * Batch fetch HTML for multiple URLs
 */
export async function batchFetchHtml(
  urls: string[],
  options: FetchHtmlOptions = {}
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // Fetch sequentially to avoid overwhelming servers
  for (const url of urls) {
    const html = await fetchHtml(url, options);
    results.set(url, html);

    // Small delay between fetches
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

