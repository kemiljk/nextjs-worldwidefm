# Stripe Membership Integration Setup

## Required Environment Variables

Add these to your `.env.local` file (development) and Vercel environment variables (production):

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...                    # Required: Your Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Required: Your Stripe publishable key
STRIPE_PRICE_ID=price_...                        # Required: The price ID for subscriptions
STRIPE_WEBHOOK_SECRET=whsec_...                  # Required: Webhook signing secret
NEXT_PUBLIC_APP_URL=http://localhost:3000        # Required: Your app's base URL
```

### ⚠️ Important:

All these environment variables **MUST** be set for the membership system to work. If any are missing, you'll see:

- "Stripe not configured" error
- "Stripe price not configured" error
- "App URL not configured" error
- Or the form will hang indefinitely

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

### Members Object Type

When a checkout is completed, a new `members` object is created in Cosmic with:

- `title`: Full name (First Last)
- `slug`: Generated from name and timestamp
- `type`: "members"
- `metadata.first_name`: First name
- `metadata.last_name`: Last name
- `metadata.email`: Email address
- `metadata.stripe_customer_id`: Stripe customer ID
- `metadata.stripe_session_id`: Stripe checkout session ID
- `metadata.stripe_subscription_id`: Stripe subscription ID (added on subscription.created)
- `metadata.subscription_status`: active, cancelled, past_due, etc.
- `metadata.subscription_start_date`: When subscription began
- `metadata.subscription_current_period_end`: When current period ends
- `metadata.last_payment_date`: Last successful payment
- `metadata.last_payment_failed_date`: Last failed payment (if any)
- `metadata.subscription_cancelled_at`: When subscription was cancelled (if applicable)

### User Object Updates

If the subscriber is a logged-in user, their user object is also updated with:

- `metadata.stripe_customer_id`: Stripe customer ID
- `metadata.stripe_subscription_id`: Stripe subscription ID
- `metadata.subscription_status`: active, cancelled, past_due, etc.
- `metadata.subscription_start_date`: When subscription began
- `metadata.subscription_current_period_end`: When current period ends
- `metadata.member_id`: Reference to the created member object
- `metadata.last_payment_date`: Last successful payment
- `metadata.last_payment_failed_date`: Last failed payment (if any)
