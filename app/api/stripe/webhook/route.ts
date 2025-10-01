import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cosmic } from '@/cosmic/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id);

  const { userId, firstName, lastName, email } = session.metadata || {};

  if (userId) {
    // Update user with subscription info
    try {
      await cosmic.objects.updateOne(userId, {
        metadata: {
          stripe_customer_id: session.customer,
          subscription_status: 'active',
          subscription_start_date: new Date().toISOString(),
        },
      });
      console.log(`Updated user ${userId} with subscription info`);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Subscription created:', subscription.id);

  const customerId = subscription.customer as string;

  try {
    // Find user by Stripe customer ID
    const users = await cosmic.objects.find({
      type: 'users',
      'metadata.stripe_customer_id': customerId,
    });

    if (users.objects && users.objects.length > 0) {
      const user = users.objects[0];
      await cosmic.objects.updateOne(user.id, {
        metadata: {
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          subscription_current_period_end: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
        },
      });
      console.log(`Updated user ${user.id} with subscription ${subscription.id}`);
    }
  } catch (error) {
    console.error('Error updating user subscription:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id);

  try {
    const users = await cosmic.objects.find({
      type: 'users',
      'metadata.stripe_subscription_id': subscription.id,
    });

    if (users.objects && users.objects.length > 0) {
      const user = users.objects[0];
      await cosmic.objects.updateOne(user.id, {
        metadata: {
          subscription_status: subscription.status,
          subscription_current_period_end: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
        },
      });
      console.log(`Updated user ${user.id} subscription status to ${subscription.status}`);
    }
  } catch (error) {
    console.error('Error updating subscription:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id);

  try {
    const users = await cosmic.objects.find({
      type: 'users',
      'metadata.stripe_subscription_id': subscription.id,
    });

    if (users.objects && users.objects.length > 0) {
      const user = users.objects[0];
      await cosmic.objects.updateOne(user.id, {
        metadata: {
          subscription_status: 'cancelled',
          subscription_cancelled_at: new Date().toISOString(),
        },
      });
      console.log(`Cancelled subscription for user ${user.id}`);
    }
  } catch (error) {
    console.error('Error cancelling subscription:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Payment succeeded:', invoice.id);

  if (invoice.subscription) {
    try {
      const users = await cosmic.objects.find({
        type: 'users',
        'metadata.stripe_subscription_id': invoice.subscription as string,
      });

      if (users.objects && users.objects.length > 0) {
        const user = users.objects[0];
        await cosmic.objects.updateOne(user.id, {
          metadata: {
            subscription_status: 'active',
            last_payment_date: new Date().toISOString(),
          },
        });
        console.log(`Updated payment status for user ${user.id}`);
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed:', invoice.id);

  if (invoice.subscription) {
    try {
      const users = await cosmic.objects.find({
        type: 'users',
        'metadata.stripe_subscription_id': invoice.subscription as string,
      });

      if (users.objects && users.objects.length > 0) {
        const user = users.objects[0];
        await cosmic.objects.updateOne(user.id, {
          metadata: {
            subscription_status: 'past_due',
            last_payment_failed_date: new Date().toISOString(),
          },
        });
        console.log(`Updated payment failure status for user ${user.id}`);
      }
    } catch (error) {
      console.error('Error updating payment failure status:', error);
    }
  }
}
