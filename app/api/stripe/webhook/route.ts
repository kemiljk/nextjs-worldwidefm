import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cosmic } from '@/cosmic/client';

export async function POST(request: NextRequest) {
  console.log('Webhook received');

  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Stripe configuration missing');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2020-08-27' as any,
    });

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const body = await request.text();
    let signature: string | null = null;
    try {
      signature = request.headers.get('stripe-signature');
    } catch (err: any) {
      if (
        err &&
        typeof err.message === 'string' &&
        err.message.toLowerCase().includes('prerender')
      ) {
        console.warn('[STRIPE] Prerender bailout while accessing headers');
        return NextResponse.json({ error: 'Prerender aborted' }, { status: 200 });
      }
      throw err;
    }

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log(`Verified event: ${event.type} [${event.id}]`);
    } catch (err) {
      const error = err as Error;
      console.error('Webhook signature verification failed:', error.message);
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
          console.log(`Unhandled event type: ${event.type} [${event.id}]`);
      }

      console.log(`Successfully processed event: ${event.type} [${event.id}]`);
      return NextResponse.json({ received: true }, { status: 200 });
    } catch (handlerError) {
      const error = handlerError as Error;
      console.error(`Error processing ${event.type} [${event.id}]:`, error.message, error.stack);
      return NextResponse.json(
        { error: 'Event processing failed', details: error.message },
        { status: 500 }
      );
    }
  } catch (error) {
    const err = error as Error;
    console.error('Webhook handler error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: err.message },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed:', session.id);

  const { userId, firstName, lastName, email } = session.metadata || {};

  if (!email || !firstName || !lastName) {
    throw new Error('Missing required member information in session metadata');
  }

  const slug = `${firstName}-${lastName}-${Date.now()}`.toLowerCase().replace(/\s+/g, '-');

  const memberData = {
    title: `${firstName} ${lastName}`,
    type: 'members',
    slug,
    metadata: {
      first_name: firstName,
      last_name: lastName,
      email: email,
      stripe_customer_id: session.customer as string,
      stripe_session_id: session.id,
      subscription_status: 'active',
      subscription_start_date: new Date().toISOString(),
    },
  };

  try {
    const member = await cosmic.objects.insertOne(memberData);
    console.log(`Created member ${member.object.id} for ${email}`);

    if (userId) {
      try {
        const userResponse = await cosmic.objects.findOne({
          type: 'users',
          id: userId,
        });

        if (userResponse?.object) {
          const updatedMetadata = {
            ...userResponse.object.metadata,
            stripe_customer_id: session.customer,
            subscription_status: 'active',
            subscription_start_date: new Date().toISOString(),
            member_id: member.object.id,
          };

          await cosmic.objects.updateOne(userId, {
            metadata: updatedMetadata,
          });
          console.log(`Updated user ${userId} with subscription info`);
        } else {
          console.warn(`User ${userId} not found, skipping user update`);
        }
      } catch (userError) {
        const error = userError as Error;
        console.error(`Error updating user ${userId}:`, error.message);
      }
    }
  } catch (memberError) {
    const error = memberError as Error;
    console.error('Error creating member:', error.message);
    throw error;
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.created:', subscription.id);

  const customerId = subscription.customer as string;
  const currentPeriodEnd = (subscription as any).current_period_end;
  const subscriptionData = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : new Date().toISOString(),
  };

  try {
    const members = await cosmic.objects.find({
      type: 'members',
      'metadata.stripe_customer_id': customerId,
    });

    if (members.objects && members.objects.length > 0) {
      const member = members.objects[0];
      const updatedMetadata = {
        ...member.metadata,
        ...subscriptionData,
      };

      await cosmic.objects.updateOne(member.id, {
        metadata: updatedMetadata,
      });
      console.log(`Updated member ${member.id} with subscription ${subscription.id}`);
    } else {
      console.warn(`No member found for customer ${customerId}`);
    }
  } catch (memberError) {
    const error = memberError as Error;
    console.error('Error updating member:', error.message);
  }

  try {
    const users = await cosmic.objects.find({
      type: 'users',
      'metadata.stripe_customer_id': customerId,
    });

    if (users.objects && users.objects.length > 0) {
      const user = users.objects[0];
      const updatedMetadata = {
        ...user.metadata,
        ...subscriptionData,
      };

      await cosmic.objects.updateOne(user.id, {
        metadata: updatedMetadata,
      });
      console.log(`Updated user ${user.id} with subscription ${subscription.id}`);
    } else {
      console.warn(`No user found for customer ${customerId}`);
    }
  } catch (userError) {
    const error = userError as Error;
    console.error('Error updating user:', error.message);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.updated:', subscription.id);

  const currentPeriodEnd = (subscription as any).current_period_end;
  const subscriptionData = {
    subscription_status: subscription.status,
    subscription_current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : new Date().toISOString(),
  };

  try {
    const members = await cosmic.objects.find({
      type: 'members',
      'metadata.stripe_subscription_id': subscription.id,
    });

    if (members.objects && members.objects.length > 0) {
      const member = members.objects[0];
      const updatedMetadata = {
        ...member.metadata,
        ...subscriptionData,
      };

      await cosmic.objects.updateOne(member.id, {
        metadata: updatedMetadata,
      });
      console.log(`Updated member ${member.id} subscription status to ${subscription.status}`);
    } else {
      console.warn(`No member found for subscription ${subscription.id}`);
    }
  } catch (memberError) {
    const error = memberError as Error;
    console.error('Error updating member:', error.message);
  }

  try {
    const users = await cosmic.objects.find({
      type: 'users',
      'metadata.stripe_subscription_id': subscription.id,
    });

    if (users.objects && users.objects.length > 0) {
      const user = users.objects[0];
      const updatedMetadata = {
        ...user.metadata,
        ...subscriptionData,
      };

      await cosmic.objects.updateOne(user.id, {
        metadata: updatedMetadata,
      });
      console.log(`Updated user ${user.id} subscription status to ${subscription.status}`);
    } else {
      console.warn(`No user found for subscription ${subscription.id}`);
    }
  } catch (userError) {
    const error = userError as Error;
    console.error('Error updating user:', error.message);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.deleted:', subscription.id);

  const cancellationData = {
    subscription_status: 'cancelled',
    subscription_cancelled_at: new Date().toISOString(),
  };

  try {
    const members = await cosmic.objects.find({
      type: 'members',
      'metadata.stripe_subscription_id': subscription.id,
    });

    if (members.objects && members.objects.length > 0) {
      const member = members.objects[0];
      const updatedMetadata = {
        ...member.metadata,
        ...cancellationData,
      };

      await cosmic.objects.updateOne(member.id, {
        metadata: updatedMetadata,
      });
      console.log(`Cancelled subscription for member ${member.id}`);
    } else {
      console.warn(`No member found for subscription ${subscription.id}`);
    }
  } catch (memberError) {
    const error = memberError as Error;
    console.error('Error updating member:', error.message);
  }

  try {
    const users = await cosmic.objects.find({
      type: 'users',
      'metadata.stripe_subscription_id': subscription.id,
    });

    if (users.objects && users.objects.length > 0) {
      const user = users.objects[0];
      const updatedMetadata = {
        ...user.metadata,
        ...cancellationData,
      };

      await cosmic.objects.updateOne(user.id, {
        metadata: updatedMetadata,
      });
      console.log(`Cancelled subscription for user ${user.id}`);
    } else {
      console.warn(`No user found for subscription ${subscription.id}`);
    }
  } catch (userError) {
    const error = userError as Error;
    console.error('Error updating user:', error.message);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_succeeded:', invoice.id);

  const subscriptionId = (invoice as any).subscription;
  if (!subscriptionId) {
    console.log('Invoice has no subscription, skipping');
    return;
  }

  const paymentData = {
    subscription_status: 'active',
    last_payment_date: new Date().toISOString(),
  };

  try {
    const members = await cosmic.objects.find({
      type: 'members',
      'metadata.stripe_subscription_id': subscriptionId as string,
    });

    if (members.objects && members.objects.length > 0) {
      const member = members.objects[0];
      const updatedMetadata = {
        ...member.metadata,
        ...paymentData,
      };

      await cosmic.objects.updateOne(member.id, {
        metadata: updatedMetadata,
      });
      console.log(`Updated payment status for member ${member.id}`);
    } else {
      console.warn(`No member found for subscription ${subscriptionId}`);
    }
  } catch (memberError) {
    const error = memberError as Error;
    console.error('Error updating member payment status:', error.message);
  }

  try {
    const users = await cosmic.objects.find({
      type: 'users',
      'metadata.stripe_subscription_id': subscriptionId as string,
    });

    if (users.objects && users.objects.length > 0) {
      const user = users.objects[0];
      const updatedMetadata = {
        ...user.metadata,
        ...paymentData,
      };

      await cosmic.objects.updateOne(user.id, {
        metadata: updatedMetadata,
      });
      console.log(`Updated payment status for user ${user.id}`);
    } else {
      console.warn(`No user found for subscription ${subscriptionId}`);
    }
  } catch (userError) {
    const error = userError as Error;
    console.error('Error updating user payment status:', error.message);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_failed:', invoice.id);

  const subscriptionId = (invoice as any).subscription;
  if (!subscriptionId) {
    console.log('Invoice has no subscription, skipping');
    return;
  }

  const paymentFailureData = {
    subscription_status: 'past_due',
    last_payment_failed_date: new Date().toISOString(),
  };

  try {
    const members = await cosmic.objects.find({
      type: 'members',
      'metadata.stripe_subscription_id': subscriptionId as string,
    });

    if (members.objects && members.objects.length > 0) {
      const member = members.objects[0];
      const updatedMetadata = {
        ...member.metadata,
        ...paymentFailureData,
      };

      await cosmic.objects.updateOne(member.id, {
        metadata: updatedMetadata,
      });
      console.log(`Updated payment failure status for member ${member.id}`);
    } else {
      console.warn(`No member found for subscription ${subscriptionId}`);
    }
  } catch (memberError) {
    const error = memberError as Error;
    console.error('Error updating member payment failure status:', error.message);
  }

  try {
    const users = await cosmic.objects.find({
      type: 'users',
      'metadata.stripe_subscription_id': subscriptionId as string,
    });

    if (users.objects && users.objects.length > 0) {
      const user = users.objects[0];
      const updatedMetadata = {
        ...user.metadata,
        ...paymentFailureData,
      };

      await cosmic.objects.updateOne(user.id, {
        metadata: updatedMetadata,
      });
      console.log(`Updated payment failure status for user ${user.id}`);
    } else {
      console.warn(`No user found for subscription ${subscriptionId}`);
    }
  } catch (userError) {
    const error = userError as Error;
    console.error('Error updating user payment failure status:', error.message);
  }
}
