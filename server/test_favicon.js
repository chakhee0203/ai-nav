const axios = require('axios');

const domain = 'gamma.app';
const candidates = [
  `https://logo.clearbit.com/${domain}`,
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  `https://${domain}/favicon.ico`,
  `https://${domain}/favicon.png`
];

async function test() {
  for (const url of candidates) {
    try {
      console.log(`Testing ${url}...`);
      const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 5000,
        validateStatus: status => status === 200 // Only accept 200
      });
      console.log(`SUCCESS: ${url} (Status: ${response.status}, Size: ${response.headers['content-length']})`);
    } catch (e) {
      console.log(`FAILED: ${url} (${e.message})`);
    }
  }
}

test();
