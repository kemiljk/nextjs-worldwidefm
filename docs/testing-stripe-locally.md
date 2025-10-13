# Testing Stripe Membership Locally

## Prerequisites

1. Stripe account in test mode
2. Stripe CLI installed
3. Test environment variables configured

## Setup Steps

### 1. Install Stripe CLI

```bash
brew install stripe/stripe-cli/stripe
```

### 2. Login to Stripe

```bash
stripe login
```

This opens your browser to authorize the CLI.

### 3. Start Webhook Forwarding

In a **separate terminal**, run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will output something like:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Copy that secret** and add it to your `.env.local`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 4. Configure Test Environment

Your `.env.local` should have:

```bash
# Stripe Test Keys (start with sk_test_ and pk_test_)
STRIPE_SECRET_KEY=sk_test_51...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_PRICE_ID=price_... # Your test price ID
STRIPE_WEBHOOK_SECRET=whsec_... # From stripe listen command
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Create a Test Price (if you haven't)

1. Go to https://dashboard.stripe.com/test/products
2. Click "Add product"
3. Name: "Worldwide FM Membership"
4. Pricing model: Recurring
5. Price: £6.00 (or your amount)
6. Billing period: Monthly
7. Click "Save product"
8. Copy the **Price ID** (starts with `price_...`)
9. Add it to your `.env.local` as `STRIPE_PRICE_ID`

## Testing the Flow

### Terminal Setup

You'll need **3 terminals**:

**Terminal 1 - Dev Server:**

```bash
cd /Users/karlkoch/Developer/nextjs-worldwidefm
bun run dev
```

**Terminal 2 - Stripe Webhook Forwarding:**

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Terminal 3 - Watch Logs:**

```bash
# Optional - to see detailed logs
stripe logs tail
```

### Test Scenarios

#### ✅ Successful Subscription (Not Logged In)

1. Go to `http://localhost:3000/membership`
2. Click "JOIN NOW"
3. Fill in the form:
   - First Name: Test
   - Last Name: User
   - Email: test@example.com
4. Click "JOIN NOW" again
5. On Stripe Checkout page:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/25`
   - CVC: `123`
   - ZIP: `12345`
6. Click "Subscribe"

**Expected Result:**

- Redirected to success page
- Terminal 2 shows webhook events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `invoice.payment_succeeded`
- Check Cosmic CMS: New member created in "members" object type

#### ✅ Successful Subscription (Logged In)

1. Login to your account
2. Go to `http://localhost:3000/membership`
3. Click "JOIN NOW" (should skip form, use your account details)
4. Complete Stripe checkout with test card
5. Check that BOTH are created:
   - Member in Cosmic
   - User object updated with `member_id` reference

#### ❌ Failed Payment

Use declining card: `4000 0000 0000 0002`

- Payment should fail
- No member created
- User sees error message

#### 🔐 3D Secure Test

Use card requiring authentication: `4000 0025 0000 3155`

- Should show 3D Secure challenge
- Complete authentication
- Payment succeeds

## Verifying the Results

### Check Cosmic CMS

1. Go to https://app.cosmicjs.com
2. Navigate to your "members" object type
3. You should see the new member with:
   - Name
   - Email
   - Stripe customer ID
   - Subscription status: "active"

### Check Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/customers
2. Find the customer you just created
3. Click on them to see:
   - Subscription details
   - Payment history
   - Events timeline

### Check Webhook Events

In Terminal 2 (stripe listen), you should see:

```
2025-10-13 14:30:00  --> checkout.session.completed [evt_xxx]
2025-10-13 14:30:01  --> customer.subscription.created [evt_xxx]
2025-10-13 14:30:02  --> invoice.payment_succeeded [evt_xxx]
2025-10-13 14:30:03  <-- [200] POST http://localhost:3000/api/stripe/webhook [evt_xxx]
```

The `[200]` means your webhook handler responded successfully.

## Troubleshooting

### Webhook Not Receiving Events

**Problem:** No events in Terminal 2

**Solution:**

- Make sure `stripe listen` is running
- Check the forwarding URL matches your local server
- Restart both the Stripe CLI and your dev server

### "Stripe not configured" Error

**Problem:** API returns 503 error

**Solution:**

- Check all environment variables are set
- Restart your dev server after adding env vars
- Make sure you're using **test** keys, not live keys

### "Missing required fields" Error

**Problem:** Form submission fails

**Solution:**

- Check browser console for JavaScript errors
- Verify all form fields are filled
- Check Network tab to see what's being sent

### Member Not Created in Cosmic

**Problem:** Webhook fires but member doesn't appear

**Solution:**

- Check your server terminal for errors
- Verify `COSMIC_WRITE_KEY` is set
- Check Cosmic CMS permissions
- Look at webhook logs: `stripe logs tail`

## Cleaning Up Test Data

### Delete Test Customers

```bash
# List test customers
stripe customers list

# Delete a specific customer
stripe customers delete cus_xxxxx
```

### Delete Test Members from Cosmic

Go to Cosmic CMS and manually delete test members, or use the Cosmic API.

## Production Deployment

When ready for production:

1. Switch to **live keys** in Vercel environment variables
2. Update webhook URL in Stripe Dashboard to production URL:
   - `https://new.worldwidefm.net/api/stripe/webhook`
3. Use the **live webhook secret** from Stripe Dashboard
4. Create a **live price** in Stripe (not test price)
5. Test with real card (or test card if Stripe allows)

## Test Checklist

- [ ] Dev server running (`bun run dev`)
- [ ] Stripe CLI forwarding webhooks (`stripe listen...`)
- [ ] All test environment variables set
- [ ] Test price created in Stripe
- [ ] Can submit membership form
- [ ] Can complete Stripe checkout with test card
- [ ] Member created in Cosmic
- [ ] Webhooks received successfully (check Terminal 2)
- [ ] User object linked to member (if logged in)

---

**Need Help?**

- Stripe Test Cards: https://stripe.com/docs/testing
- Stripe CLI Docs: https://stripe.com/docs/stripe-cli
- Webhook Testing: https://stripe.com/docs/webhooks/test
