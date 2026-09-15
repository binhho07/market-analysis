const { chromium } = require('playwright-core');

async function quickTest() {
  console.log('🧪 Quick scraper test...\n');
  
  try {
    // Simple test without Puppeteer
    const https = require('https');
    const url = 'https://www.example.com';
    
    console.log(`Testing HTTP request to: ${url}`);
    
    https.get(url, (res) => {
      console.log(`✅ Status: ${res.statusCode}`);
      console.log(`✅ Headers: ${JSON.stringify(res.headers, null, 2)}`);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ Received ${data.length} bytes`);
        console.log(`✅ Basic HTTP works!`);
        process.exit(0);
      });
    }).on('error', (err) => {
      console.error(`❌ Error: ${err.message}`);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

quickTest();
