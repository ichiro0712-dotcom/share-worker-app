/**
 * BankcodeJP API テストスクリプト
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.BANKCODEJP_API_KEY;
console.log('API Key exists:', Boolean(apiKey));
console.log('API Key length:', apiKey ? apiKey.length : 0);

if (!apiKey) {
  console.log('ERROR: API Key not found in .env.local');
  process.exit(1);
}

async function testAPI() {
  const url = 'https://apis.bankcode-jp.com/v3/freeword/banks?freeword=gmo&limit=5&fields=code,name,hiragana';
  console.log('\nTesting URL:', url);

  const response = await fetch(url, {
    headers: { apikey: apiKey! }
  });

  console.log('Status:', response.status);
  console.log('Status Text:', response.statusText);

  const data = await response.json();
  console.log('\nResponse:', JSON.stringify(data, null, 2));
}

testAPI().catch(e => console.error('Error:', e));
