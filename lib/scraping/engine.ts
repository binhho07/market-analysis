import { htmlNeedsBrowser, menuFromHtml, scrapeWithCheerio, type ScrapeResult } from "./cheerio-scraper";
import { closeBrowser, createPage, getBrowser, navigateToUrl } from "./browser";

export interface EngineResult extends ScrapeResult {
  engine: "cheerio" | "puppeteer";
  latencyMs: number;
  fallback: boolean;
}

export async function scrapeWithBrowser(url: string, html?: string): Promise<EngineResult> {
  const started = Date.now();
  const page = await createPage();
  try {
    if (html) {
      await page.setContent(html, { waitUntil: "domcontentloaded" });
    } else {
      const opened = await navigateToUrl(page, url, 2);
      if (!opened) {
        return {
          success: false,
          services: [],
          source: url,
          confidence: 0,
          engine: "puppeteer",
          latencyMs: Date.now() - started,
          fallback: true,
        };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    const rendered = await page.content();
    const menu = menuFromHtml(rendered, url);
    return {
      ...menu,
      engine: "puppeteer",
      latencyMs: Date.now() - started,
      fallback: true,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function scrapeWithFallback(name: string, url: string, html?: string): Promise<EngineResult> {
  const started = Date.now();
  if (html) {
    const parsed = menuFromHtml(html, url);
    if (parsed.success && !htmlNeedsBrowser(html)) {
      return { ...parsed, engine: "cheerio", latencyMs: Date.now() - started, fallback: false };
    }
    const rendered = await scrapeWithBrowser(url, html);
    return rendered.success ? rendered : { ...parsed, engine: "cheerio", latencyMs: Date.now() - started, fallback: false };
  }

  const cheerioResult = await scrapeWithCheerio(url, name);
  if (cheerioResult.success) {
    return { ...cheerioResult, engine: "cheerio", latencyMs: Date.now() - started, fallback: false };
  }
  if (process.env.VERCEL === "1") {
    return { ...cheerioResult, engine: "cheerio", latencyMs: Date.now() - started, fallback: false };
  }
  try {
    return await scrapeWithBrowser(url);
  } catch (error: any) {
    return {
      ...cheerioResult,
      engine: "cheerio",
      latencyMs: Date.now() - started,
      fallback: false,
      success: false,
      reason: error?.message,
    } as EngineResult;
  }
}

export async function shutdownBrowser() {
  await closeBrowser();
}

export async function browserReady() {
  await getBrowser();
}
