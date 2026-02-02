import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function updateSchema() {
  try {
    console.log('Checking "users" object type...');
    const usersResp = await cosmic.objectTypes.findOne('users');
    const existingKeys = usersResp.object_type.metafields.map((m: any) => m.key);

    const requiredFields = [
      {
        title: 'Stripe Customer ID',
        key: 'stripe_customer_id',
        type: 'text',
      },
      {
        title: 'Subscription Status',
        key: 'subscription_status',
        type: 'text',
      },
      {
        title: 'Subscription Start Date',
        key: 'subscription_start_date',
        type: 'text',
      },
      {
        title: 'Subscription Current Period End',
        key: 'subscription_current_period_end',
        type: 'text',
      },
      {
        title: 'Stripe Subscription ID',
        key: 'stripe_subscription_id',
        type: 'text',
      },
      {
        title: 'Member ID',
        key: 'member_id',
        type: 'text',
      }
    ];

    const fieldsToAdd = requiredFields.filter(f => !existingKeys.includes(f.key));

    if (fieldsToAdd.length > 0) {
      console.log(`Adding ${fieldsToAdd.length} missing fields to "users":`, fieldsToAdd.map(f => f.key));
      
      const updatedMetafields = [
        ...usersResp.object_type.metafields,
        ...fieldsToAdd
      ];

      await cosmic.objectTypes.updateOne('users', {
        metafields: updatedMetafields
      });
      console.log('Successfully updated "users" schema.');
    } else {
      console.log('All required Stripe fields already exist in "users" schema.');
    }
  } catch (e: any) {
    console.error('Error updating schema:', e.message);
  }
}

updateSchema();
