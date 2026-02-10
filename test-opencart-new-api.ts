import { prisma } from './lib/prisma';
import axios from 'axios';
import { decryptSiteToken } from './lib/middleware/encryption';

async function testAPI() {
    const site = await prisma.site.findFirst({
        where: { id: 'cmlf4ph06000zo08ospo4u7rk' },
    });

    if (!site) {
        console.error('Site not found');
        return;
    }

    console.log('🔍 Testing OpenCart API...');
    console.log('Site:', site.baseUrl);

    const decryptedSite = await decryptSiteToken(site);
    const apiToken = decryptedSite.apiToken;

    if (!apiToken) {
        console.error('❌ API token is null after decryption');
        return;
    }

    console.log('Token (first 20 chars):', apiToken.substring(0, 20) + '...');

    const cleanBaseUrl = site.baseUrl.replace(/\/$/, "");
    const apiUrl = `${cleanBaseUrl}/api/pricepilot.php?api_token=${apiToken}&action=products`;

    console.log('\n📡 Calling API:', apiUrl.replace(apiToken, 'TOKEN_HIDDEN'));

    try {
        const response = await axios.get(apiUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'PricePilot/1.0',
            }
        });

        console.log('\n✅ Response Status:', response.status);
        console.log('Response Headers:', response.headers['content-type']);
        console.log('\n📦 Response Data Type:', typeof response.data);

        if (typeof response.data === 'string') {
            console.log('\n⚠️  Response is a string (should be JSON object)');
            console.log('First 500 chars:', response.data.substring(0, 500));
        } else {
            console.log('\n✅ Response is JSON object');
            console.log('Keys:', Object.keys(response.data));

            if (response.data.success !== undefined) {
                console.log('Success:', response.data.success);
            }

            if (response.data.products) {
                console.log('Products count:', response.data.products.length);
                if (response.data.products.length > 0) {
                    console.log('\nFirst product:', JSON.stringify(response.data.products[0], null, 2));
                }
            }

            if (response.data.error) {
                console.log('❌ Error:', response.data.error);
            }
        }
    } catch (error: any) {
        console.error('\n❌ API Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }

    await prisma.$disconnect();
}

testAPI().catch(console.error);
