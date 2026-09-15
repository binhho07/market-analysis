const https = require('https');
const cheerio = require('cheerio');

async function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractPrices(text) {
  const prices = [];
  const matches = text.matchAll(/\$\s*(\d+(?:\.\d{2})?)/g);
  for (const match of matches) {
    const price = parseFloat(match[1]);
    if (price >= 10 && price <= 500) {
      prices.push(price);
    }
  }
  return prices;
}

async function test() {
  console.log('🧪 Testing Cheerio Scraper\n');
  
  // Test with a simple page that might have prices
  const testUrl = 'https://www.vagaro.com'; // Booking platform that lists services
  
  try {
    console.log(`Fetching: ${testUrl}`);
    const html = await fetchHTML(testUrl);
    console.log(`✅ Fetched ${html.length} bytes\n`);
    
    const $ = cheerio.load(html);
    
    // Look for any prices
    const allText = $('body').text();
    const prices = extractPrices(allText);
    
    console.log(`Found ${prices.length} prices:`);
    prices.slice(0, 10).forEach(p => console.log(`  $${p}`));
    
    console.log(`\n✅ Cheerio scraping works!`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

test();
