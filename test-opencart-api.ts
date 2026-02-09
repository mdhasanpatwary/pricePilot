import { prisma } from './lib/prisma';
import axios from 'axios';

async function testOpenCartAPI() {
    const site = await prisma.site.findFirst({
        where: {
            tenantId: 'f1bad9f5-30c0-479f-8422-f70fe9748663',
            type: 'USER'
        }
    });

    if (!site) {
        console.log('❌ No USER site found');
        return;
    }

    console.log('🔍 Testing OpenCart API...');
    console.log('Site:', site.baseUrl);

    const apiUrl = `${site.baseUrl.replace(/\/$/, '')}/index.php?route=api/pricepilot&api_token=${site.apiToken}`;

    try {
        const response = await axios.get(apiUrl, { timeout: 30000 });

        console.log('\n✅ API Response received');
        console.log('Total products:', response.data.products?.length || 0);

        if (response.data.products && response.data.products.length > 0) {
            console.log('\n📦 First 3 products:');
            response.data.products.slice(0, 3).forEach((p: any, i: number) => {
                console.log(`\n${i + 1}. ${p.name || p.title}`);
                console.log(`   - product_id: ${p.product_id || p.id}`);
                console.log(`   - sku: ${p.sku || 'N/A'}`);
                console.log(`   - price: ${p.price}`);
                console.log(`   - image: ${p.image || 'NULL/MISSING ❌'}`);
                console.log(`   - manufacturer: ${p.manufacturer || 'N/A'}`);
                console.log(`   - model: ${p.model || 'N/A'}`);
            });

            const withImages = response.data.products.filter((p: any) => p.image).length;
            console.log(`\n📊 ${withImages}/${response.data.products.length} products have images`);
        }
    } catch (error: any) {
        console.error('❌ API Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data).substring(0, 200));
        }
    }

    await prisma.$disconnect();
}

testOpenCartAPI();
