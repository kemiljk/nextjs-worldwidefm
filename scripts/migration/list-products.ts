
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is missing from .env.local');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27' as any,
});

async function listProducts() {
  console.log('🔄 Fetching active Stripe products...');

  try {
    const products = await stripe.products.list({
      active: true,
      limit: 100,
    });

    if (products.data.length === 0) {
      console.log('⚠️ No active products found.');
      return;
    }

    console.log('\n📦 Active Products:');
    console.log('================================================');
    
    products.data.forEach((product) => {
      console.log(`Name: ${product.name}`);
      console.log(`ID:   ${product.id}`);
      console.log(`Desc: ${product.description || 'N/A'}`);
      console.log('------------------------------------------------');
    });

    console.log(`\nFound ${products.data.length} active products.`);
  } catch (error: any) {
    console.error('❌ Error fetching products:', error.message);
  }
}

listProducts();
