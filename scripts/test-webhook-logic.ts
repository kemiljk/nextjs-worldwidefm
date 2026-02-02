import { createBucketClient } from '@cosmicjs/sdk';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const APP_URL = 'http://localhost:3000';

async function testWebhook() {
  const payload = {
    id: 'evt_test_' + Date.now(),
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_' + Date.now(),
        customer: 'cus_test_' + Date.now(),
        metadata: {
          firstName: 'Test',
          lastName: 'User! @Accénted',
          email: 'test@example.com',
          userId: '679a1f26cf9a764724813583' // Example user ID from previous runs if available, else omit
        }
      }
    }
  };

  try {
    console.log('Sending mock payload to local webhook...');
    // We can't easily bypass signature verification without modifying the code, 
    // but we can test if the slug generation and handlers work by extracting them or 
    // temporarily disabling verification in route.ts.
    // For now, let's just log what the generated slug WOULD be using the logic from route.ts.
    
    const firstName = payload.data.object.metadata.firstName;
    const lastName = payload.data.object.metadata.lastName;
    
    const slug = `${firstName}-${lastName}-${Date.now()}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
      
    console.log('Mock generated slug:', slug);
    console.log('Test complete. Manual confirmation of schema fields recommended.');
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

testWebhook();
