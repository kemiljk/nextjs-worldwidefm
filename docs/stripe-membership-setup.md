# Stripe Membership Integration Setup

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Stripe Dashboard Setup

1. **Create a Subscription Product**:

   - Go to Stripe Dashboard > Products
   - Create a new product for "Worldwide FM Membership"
   - Set price to $9.99/month (recurring)
   - Copy the Price ID to `STRIPE_PRICE_ID`

2. **Set up Webhook Endpoint**:
   - Go to Stripe Dashboard > Webhooks
   - Add endpoint: `https://yourdomain.com/api/stripe/webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

## Features Implemented

- **Membership Sign-up Page** (`/membership`): Clean signup form with Stripe integration
- **Stripe Checkout**: Secure payment processing via Stripe Checkout
- **Webhook Handling**: Automatic subscription status updates
- **Dashboard Integration**: Membership status display in user dashboard
- **Footer Integration**: Updated Subscribe button links to membership
- **Success Page**: Confirmation page after successful subscription

## User Flow

1. User clicks "Subscribe" in footer or dashboard
2. Redirected to `/membership` page
3. Fills out form (pre-populated if logged in)
4. Redirected to Stripe Checkout
5. Completes payment
6. Redirected to success page
7. Webhook updates user subscription status
8. Dashboard shows active membership status

## Database Schema

The system adds these fields to user metadata:

- `stripe_customer_id`: Stripe customer ID
- `stripe_subscription_id`: Stripe subscription ID
- `subscription_status`: active, cancelled, past_due, etc.
- `subscription_start_date`: When subscription began
- `subscription_current_period_end`: When current period ends
- `last_payment_date`: Last successful payment
- `last_payment_failed_date`: Last failed payment (if any)
