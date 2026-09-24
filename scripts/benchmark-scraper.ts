import fs from "fs";
import path from "path";
import { menuFromHtml } from "../lib/scraping/cheerio-scraper";
import { scrapeWithBrowser, shutdownBrowser } from "../lib/scraping/engine";
import { selectBestUrl } from "../lib/search/domainClassifier";

type PriceCase = {
  id: string;
  name: string;
  js: boolean;
  gel: number;
  pedicure: number;
  acrylic: number;
};

type DiscoveryCase = {
  id: string;
  name: string;
  expectedHost: string | null;
  urls: string[];
};

function menuHtml(row: PriceCase) {
  const rows = [
    ["Gel Manicure", row.gel],
    ["Spa Pedicure", row.pedicure],
    ["Acrylic Full Set", row.acrylic],
  ];
  const table = `<table>${rows
    .map(([name, price]) => `<tr><td>${name}</td><td>$${price}</td></tr>`)
    .join("")}</table>`;
  if (!row.js) {
    return `<html><body><h1>${row.name}</h1>${table}</body></html>`;
  }
  return `<html><body><div id="root"></div><script>document.getElementById("root").innerHTML=${JSON.stringify(
    table
  )};</script></body></html>`;
}

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function main() {
  const datasetPath = path.join(process.cwd(), "benchmarks/dataset.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as {
    priceCases: PriceCase[];
    discoveryCases: DiscoveryCase[];
  };

  let labeled = 0;
  let correct = 0;
  let extracted = 0;
  let successes = 0;
  const latencies: number[] = [];
  const misses: string[] = [];

  for (const row of dataset.priceCases) {
    const html = menuHtml(row);
    const started = performance.now();
    let result = menuFromHtml(html, `https://${row.id}.example`);
    let engine = "cheerio";
    if (row.js) {
      try {
        result = await scrapeWithBrowser(`https://${row.id}.example`, html);
        engine = result.engine;
      } catch (error: any) {
        misses.push(`${row.id} browser failed: ${error?.message || error}`);
      }
    }
    latencies.push(Math.round((result.latencyMs || performance.now() - started) * 10) / 10);
    if (result.success) successes += 1;
    for (const field of ["gel", "pedicure", "acrylic"] as const) {
      labeled += 1;
      const actual = result[field];
      if (actual != null) extracted += 1;
      if (actual != null && Math.abs(actual - row[field]) <= 1) correct += 1;
      else misses.push(`${row.id} ${field} via ${engine}: expected ${row[field]} got ${actual ?? "none"}`);
    }
  }

  let discoveryCorrect = 0;
  for (const row of dataset.discoveryCases) {
    const chosen = hostOf(selectBestUrl(row.urls, row.name));
    if (chosen === row.expectedHost) discoveryCorrect += 1;
    else misses.push(`${row.id} discovery: expected ${row.expectedHost} got ${chosen}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: {
      priceCases: dataset.priceCases.length,
      discoveryCases: dataset.discoveryCases.length,
    },
    websiteDiscoveryAccuracy: Number((discoveryCorrect / dataset.discoveryCases.length).toFixed(3)),
    priceExtractionPrecision: extracted ? Number((correct / extracted).toFixed(3)) : 0,
    priceExtractionRecall: Number((correct / labeled).toFixed(3)),
    scrapeSuccessRate: Number((successes / dataset.priceCases.length).toFixed(3)),
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
    },
    counts: {
      labeledPrices: labeled,
      extractedPrices: extracted,
      correctPrices: correct,
      successfulScrapes: successes,
      discoveryCorrect,
    },
    misses: misses.slice(0, 20),
  };

  const out = path.join(process.cwd(), "benchmarks/latest.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await shutdownBrowser();
}

main().catch(async (error) => {
  console.error(error);
  await shutdownBrowser();
  process.exit(1);
});
