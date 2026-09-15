/**
 * Verify scraping and estimation logic
 */

import { scrapeWithCheerio } from "../lib/scraping/cheerio-scraper.js";

async function test() {
  console.log("🧪 Verification Test\n");

  // 1. Test Real Website (if known)
  const realSites = [
    { name: "Vagaro Test", url: "https://www.vagaro.com" }, // Often has prices
    { name: "Google", url: "https://www.google.com" } // Should fail gracefully
  ];

  for (const site of realSites) {
    console.log(`Testing ${site.name}...`);
    const result = await scrapeWithCheerio(site.url, site.name);
    console.log("Result:", {
      success: result.success,
      gel: result.gel,
      pedicure: result.pedicure
    });
    console.log("-".repeat(30));
  }

  // 2. Test Estimation Logic (Simulation)
  console.log("\n🧪 Testing Estimation Logic (Simulation)");
  const mockCompetitors = [
    { name: "Budget Salon", priceLevel: 1 },
    { name: "Mid-Range Spa", priceLevel: 2 },
    { name: "Luxury Lounge", priceLevel: 3 }
  ];

  mockCompetitors.forEach(comp => {
    const estimates = {
      1: { gel: 30, pedicure: 35, acrylic: 45 },
      2: { gel: 40, pedicure: 45, acrylic: 55 },
      3: { gel: 50, pedicure: 60, acrylic: 70 }
    }[comp.priceLevel] || { gel: 40, pedicure: 45, acrylic: 55 };

    console.log(`${comp.name} ($${comp.priceLevel}): Gel $${estimates.gel}, Pedi $${estimates.pedicure}`);
  });
}

test();

