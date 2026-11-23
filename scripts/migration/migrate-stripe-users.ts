
import Stripe from 'stripe';
import { createBucketClient } from '@cosmicjs/sdk';
import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default to true for safety
const OLD_PRODUCT_ID = process.env.OLD_PRODUCT_ID;
const BATCH_SIZE = 50;

if (!process.env.STRIPE_MIGRATION_KEY) throw new Error('Missing STRIPE_MIGRATION_KEY');
if (!process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG) throw new Error('Missing NEXT_PUBLIC_COSMIC_BUCKET_SLUG');
if (!(process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY)) throw new Error('Missing NEXT_PUBLIC_COSMIC_READ_KEY');
if (!process.env.COSMIC_WRITE_KEY) throw new Error('Missing COSMIC_WRITE_KEY');
if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');

const stripe = new Stripe(process.env.STRIPE_MIGRATION_KEY, { apiVersion: '2020-08-27' as any });
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: (process.env.COSMIC_READ_KEY || process.env.NEXT_PUBLIC_COSMIC_READ_KEY)!,
  writeKey: process.env.COSMIC_WRITE_KEY,
});
const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  console.log(`🚀 Starting Migration Script ${DRY_RUN ? '(DRY RUN)' : ''}`);
  if (!OLD_PRODUCT_ID) {
    console.error('❌ OLD_PRODUCT_ID environment variable is required.');
    process.exit(1);
  }
  console.log(`Targeting Product ID: ${OLD_PRODUCT_ID}`);

  console.log('🔄 Fetching subscriptions...');
  const subscriptions = [];
  try {
    for await (const sub of stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.customer', 'data.plan.product'],
    })) {
      const product = (sub as any).plan.product;
      const productId = typeof product === 'string' ? product : product.id;
      
      if (productId === OLD_PRODUCT_ID) {
        subscriptions.push(sub);
      }
    }
  } catch (e: any) {
    console.warn('Stripe list failed, falling back to manual search or check error', e);
  }

  // NOTE: The above 'for await' iterates ALL subscriptions. This might be slow if there are thousands of non-migrating subs.
  
  console.log(`Found ${subscriptions.length} active subscriptions for product ${OLD_PRODUCT_ID}`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const sub of subscriptions) {
    try {
      const customer = sub.customer as Stripe.Customer;
      const email = customer.email;
      
      if (!email) {
        console.warn(`⚠️ Subscription ${sub.id} has no customer email. Skipping.`);
        errorCount++;
        continue;
      }

      console.log(`\n👤 Processing ${email} (Customer: ${customer.id})...`);
    
      let memberId: string | null = null;
      let memberAction = 'none'; // 'created', 'found', 'error'
      
      try {
        const existingMemberRes = await cosmic.objects.findOne({
          type: 'members',
          'metadata.stripe_subscription_id': sub.id,
        }).props('id').depth(0);
        
        if (existingMemberRes.object) {
          memberId = existingMemberRes.object.id;
          memberAction = 'found';
          console.log(`  📎 Found existing Member: ${memberId}`);
        }
      } catch (err) {
        // Not found, will create
      }

      const memberSlug = `${customer.name || 'member'}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const memberMetadata = {
        first_name: (customer.name || '').split(' ')[0] || '',
        last_name: (customer.name || '').split(' ').slice(1).join(' ') || '',
        email: email,
        stripe_customer_id: customer.id,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        subscription_start_date: new Date(sub.created * 1000).toISOString(),
      };

      if (!memberId) {
         if (DRY_RUN) {
            console.log(`  [DRY RUN] Would create Member for ${email}`);
         } else {
            const memberRes = await cosmic.objects.insertOne({
              title: customer.name || email,
              type: 'members',
              slug: memberSlug,
              metadata: memberMetadata,
            });
            memberId = memberRes.object.id;
            memberAction = 'created';
            console.log(`  ✅ Created Member: ${memberId}`);
         }
      }

      let existingUser = null;
      try {
        const res = await cosmic.objects.findOne({
          type: 'users',
          'metadata.email': email.toLowerCase(),
        }).props('id, metadata').depth(0);
        existingUser = res.object;
      } catch (err) {
        // Not found
      }

      if (existingUser) {
        console.log(`  ↪️ User exists (ID: ${existingUser.id}). Updating with Stripe info...`);
        
        if (DRY_RUN) {
            console.log(`  [DRY RUN] Would update User ${existingUser.id} with membership details`);
            successCount++;
            continue;
        }

        await cosmic.objects.updateOne(existingUser.id, {
            metadata: {
                stripe_customer_id: customer.id,
                stripe_subscription_id: sub.id,
                subscription_status: sub.status,
                member_id: memberId,
            }
        });
        console.log(`  ✅ Updated User: ${existingUser.id}`);
        // Do NOT send email for existing users
        successCount++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would create User and Member for ${email}`);
        console.log(`  [DRY RUN] Would link to Stripe Customer ${customer.id}`);
        console.log(`  [DRY RUN] Would send migration email`);
        successCount++;
        continue;
      }

      const tempPassword = crypto.randomUUID(); // Random password, they must reset
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiry for migration

      const userRes = await cosmic.objects.insertOne({
        title: customer.name || email,
        type: 'users',
        metadata: {
          first_name: (customer.name || '').split(' ')[0] || '',
          last_name: (customer.name || '').split(' ').slice(1).join(' ') || '',
          email: email,
          password: hashedPassword,
          active_status: true,
          email_verified: true, // Auto-verify since they came from Stripe
          stripe_customer_id: customer.id,
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          member_id: memberId,
          reset_password_token: resetToken,
          reset_password_expiry: resetExpiry,
        },
      });
      console.log(`  ✅ Created User: ${userRes.object.id}`);

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
      await resend.emails.send({
        from: `Worldwide FM Support <${process.env.SUPPORT_EMAIL || 'support@worldwidefm.net'}>`,
        to: email,
        subject: 'Action Required: Your Worldwide FM Account',
        html: `
          <h1>Welcome to the new Worldwide FM!</h1>
          <p>We have migrated your membership to our new platform.</p>
          <p>To access your account and manage your subscription, please set a new password by clicking the link below:</p>
          <a href="${resetUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;">Set My Password</a>
          <p>This link is valid for 7 days.</p>
          <p>Thank you for your continued support!</p>
        `,
      });
      console.log(`  📧 Sent migration email to ${email}`);

      successCount++;
    } catch (err: any) {
      console.error(`  ❌ Error processing ${sub.id}:`, err.message);
      errorCount++;
    }
  }

  console.log('\n================================');
  console.log(`SUMMARY:`);
  console.log(`Processed: ${subscriptions.length}`);
  console.log(`Success:   ${successCount}`);
  console.log(`Skipped:   ${skipCount}`);
  console.log(`Errors:    ${errorCount}`);
}

main().catch(console.error);
