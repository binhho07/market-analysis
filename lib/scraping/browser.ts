import { Browser, Page } from "puppeteer";
// @ts-ignore - no types available for user-agents
import UserAgent from "user-agents";

let browser: Browser | null = null;

// Detect if running on Vercel
const isVercel = process.env.VERCEL === '1';

/**
 * Get or create Puppeteer browser instance
 */
export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    if (isVercel) {
      // Use Vercel-compatible setup
      try {
        const chromium = await import("@sparticuz/chromium");
        const puppeteerCore = await import("puppeteer-core");
        
        browser = await puppeteerCore.default.launch({
          args: [...chromium.default.args, '--single-process'],
          defaultViewport: chromium.default.defaultViewport,
          executablePath: await chromium.default.executablePath({
            path: '/tmp/chromium',
          }),
          headless: chromium.default.headless,
        });
      } catch (error: any) {
        console.error("❌ Failed to load Chromium on Vercel:", error.message);
        throw new Error("Browser scraping not available on Vercel");
      }
    } else {
      // Use regular Puppeteer for local development
      const puppeteer = await import("puppeteer");
      
      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920x1080",
          // Disable blocking features that cause ERR_BLOCKED_BY_CLIENT
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-blink-features=AutomationControlled",
          "--disable-web-security",
          "--disable-features=site-per-process",
        ],
      });
    }
  }
  return browser;
}

/**
 * Create new page with random user agent
 */
export async function createPage(): Promise<Page> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  // BLOCK ONLY HEAVY RESOURCES (keep essential content)
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const resourceType = request.resourceType();
    
    // Only block truly unnecessary resources
    if (
      resourceType === 'image' || 
      resourceType === 'media' ||
      resourceType === 'font'
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });
  
  // Set random user agent
  const userAgent = new UserAgent({ deviceCategory: "desktop" });
  await page.setUserAgent(userAgent.toString());
  
  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set extra headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  });
  
  return page;
}

/**
 * Close browser
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Navigate to URL with retry logic and multiple strategies
 */
export async function navigateToUrl(
  page: Page,
  url: string,
  retries: number = 3
): Promise<boolean> {
  // Try different strategies
  const strategies = [
    { waitUntil: "domcontentloaded" as const, timeout: 15000 }, // Fastest
    { waitUntil: "networkidle0" as const, timeout: 20000 },     // Medium
    { waitUntil: "load" as const, timeout: 25000 },             // Backup
  ];

  for (let i = 0; i < retries; i++) {
    const strategy = strategies[i] || strategies[0];
    
    try {
      await page.goto(url, strategy);
      return true;
    } catch (error: any) {
      console.error(`Navigation attempt ${i + 1} failed:`, error.message);
      
      // If it's ERR_BLOCKED_BY_CLIENT, try with a different URL scheme
      if (error.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
        try {
          // Try HTTPS if HTTP, or vice versa
          const altUrl = url.startsWith('https://') 
            ? url.replace('https://', 'http://')
            : url.replace('http://', 'https://');
          
          console.log(`  🔄 Trying alternate URL: ${altUrl}`);
          await page.goto(altUrl, strategy);
          return true;
        } catch (altError) {
          console.error(`  ❌ Alternate URL also failed`);
        }
      }
      
      if (i === retries - 1) {
        return false;
      }
      
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return false;
}

/**
 * Take screenshot for debugging
 */
export async function takeScreenshot(
  page: Page,
  filename: string
): Promise<void> {
  try {
    await page.screenshot({ path: filename as `${string}.png`, fullPage: true });
  } catch (error) {
    console.error("Screenshot error:", error);
  }
}

/**
 * Wait for selector with timeout
 */
export async function waitForSelector(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Extract text from selector
 */
export async function extractText(
  page: Page,
  selector: string
): Promise<string | null> {
  try {
    const element = await page.$(selector);
    if (!element) return null;
    
    const text = await page.evaluate((el) => el?.textContent?.trim() || "", element);
    return text || null;
  } catch (_error) {
    return null;
  }
}

/**
 * Extract multiple texts
 */
export async function extractTexts(
  page: Page,
  selector: string
): Promise<string[]> {
  try {
    const elements = await page.$$(selector);
    const texts: string[] = [];
    
    for (const element of elements) {
      const text = await page.evaluate((el) => el?.textContent?.trim() || "", element);
      if (text) texts.push(text);
    }
    
    return texts;
  } catch (_error) {
    return [];
  }
}



