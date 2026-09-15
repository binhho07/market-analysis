const https = require('https');

console.log('🧪 Testing basic web scraping...\n');

const testUrl = 'https://www.example.com';

console.log(`Fetching: ${testUrl}\n`);

https.get(testUrl, (res) => {
  console.log(`✅ Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`✅ Received ${data.length} bytes`);
    console.log(`✅ Contains "Example": ${data.includes('Example')}`);
    console.log('\n✅ HTTP requests work! Scraping is possible.\n');
    process.exit(0);
  });
}).on('error', (err) => {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
});
