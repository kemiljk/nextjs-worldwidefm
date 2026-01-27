
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is missing from .env.local');
  process.exit(1);
}

const key = process.env.STRIPE_SECRET_KEY;
console.log(`ℹ️  Using Stripe Key starting with: ${key.substring(0, 8)}...`);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27' as any,
});

const PRODUCT_ID = 'prod_JBZFz2KRGFumXU';

async function checkProduct() {
  console.log(`🔄 Checking product: ${PRODUCT_ID}...`);

  try {
    const product = await stripe.products.retrieve(PRODUCT_ID);
    console.log('✅ Product found:');
    console.log(JSON.stringify(product, null, 2));
  } catch (error: any) {
    console.error('❌ Error fetching product:', error.message);
    if (error.raw) {
        console.error('  Code:', error.raw.code);
        console.error('  Type:', error.raw.type);
    }
  }
}

checkProduct();
