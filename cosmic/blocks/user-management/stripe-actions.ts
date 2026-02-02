'use server';

import { stripe } from '@/lib/stripe';
import { cosmic } from '@/lib/cosmic-config';
import { getAuthUser } from './actions';

export async function createStripePortalSession(userId: string) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.id !== userId) {
      return {  error: 'Unauthorized' };
    }

    // specific lookup to get stripe_customer_id
    const { object: user } = await cosmic.objects
      .findOne({ id: userId })
      .props('metadata.stripe_customer_id')
      .depth(0);

    const customerId = user?.metadata?.stripe_customer_id;

    if (!customerId) {
        return { error: 'No Stripe customer found for this user.' };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    return { url: session.url };
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return { error: error.message || 'Failed to create portal session' };
  }
}
