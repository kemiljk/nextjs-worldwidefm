# Environment Variables Configuration

This document lists all required environment variables for the Worldwide FM application.

## 🌐 Domain Configuration

**Important:** The application is domain-agnostic and uses environment variables for all URLs. This means it works on any domain/subdomain (e.g., `new.worldwidefm.net`, `worldwidefm.net`, `staging.worldwidefm.net`).

### NEXT_PUBLIC_APP_URL

**Required:** Yes  
**Description:** The full URL of your application (used for redirects, webhooks, etc.)  
**Format:** Must include protocol (`https://` or `http://`)  
**Examples:**

```bash
# Production
NEXT_PUBLIC_APP_URL=https://worldwidefm.net

# Staging/Preview
NEXT_PUBLIC_APP_URL=https://new.worldwidefm.net

# Local Development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Used in:**

- Stripe checkout success/cancel URLs
- Email links
- Social sharing
- API callbacks

## 📦 Cosmic CMS

```bash
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your-bucket-slug
NEXT_PUBLIC_COSMIC_READ_KEY=your-read-key
COSMIC_WRITE_KEY=your-write-key
```

**Where to find:**

- Go to https://app.cosmicjs.com
- Select your bucket
- Settings → API Access

## 🎵 RadioCult Integration

```bash
NEXT_PUBLIC_RADIOCULT_STATION_ID=your-station-id
RADIOCULT_SECRET_KEY=your-secret-key
```

**Where to find:**

- RadioCult dashboard
- API settings section

## 💳 Stripe Membership

```bash
# Stripe Keys (Test or Live)
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... or pk_live_...

# Subscription Price
STRIPE_PRICE_ID=price_...

# Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Where to find:**

- Test keys: https://dashboard.stripe.com/test/apikeys
- Live keys: https://dashboard.stripe.com/apikeys
- Price ID: https://dashboard.stripe.com/products
- Webhook secret: https://dashboard.stripe.com/webhooks

**Important:**

- Use **test keys** for development/staging
- Use **live keys** for production only
- Update webhook URL in Stripe when changing domains

## 🔐 Security & Cron

```bash
# For cron job authentication
CRON_SECRET=your-secure-random-string

# For manual revalidation
REVALIDATION_SECRET=your-secure-random-string
```

**How to generate:**

```bash
# On macOS/Linux
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 📧 Email (Resend)

```bash
RESEND_API_KEY=re_...
SUPPORT_EMAIL=noreply@worldwidefm.net
```

**Where to find:**

- Resend dashboard: https://resend.com/api-keys
- Support email should match your verified domain in Resend

## 🔍 Analytics (Optional)

```bash
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=worldwidefm.net
```

Currently commented out in `app/layout.tsx`. Uncomment when ready to use.

## Environment-Specific Configuration

### Local Development (`.env.local`)

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cosmic (use your bucket)
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=worldwidefm
NEXT_PUBLIC_COSMIC_READ_KEY=...
COSMIC_WRITE_KEY=...

# RadioCult
NEXT_PUBLIC_RADIOCULT_STATION_ID=...
RADIOCULT_SECRET_KEY=...

# Stripe (TEST mode)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_... # Test price
STRIPE_WEBHOOK_SECRET=whsec_... # From stripe listen

# Security (local secrets)
CRON_SECRET=local-test-secret
REVALIDATION_SECRET=local-test-secret

# Email
RESEND_API_KEY=re_...
SUPPORT_EMAIL=noreply@worldwidefm.net
```

### Staging/Preview (Vercel)

Same as local, but:

```bash
NEXT_PUBLIC_APP_URL=https://new.worldwidefm.net
STRIPE_WEBHOOK_SECRET=whsec_... # Live webhook secret from Stripe Dashboard
```

### Production (Vercel)

Same as staging, but:

```bash
NEXT_PUBLIC_APP_URL=https://worldwidefm.net

# Stripe LIVE keys
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_ID=price_... # Live price
STRIPE_WEBHOOK_SECRET=whsec_... # Live webhook secret
```

## Setting Environment Variables in Vercel

1. Go to your project in Vercel
2. Settings → Environment Variables
3. Add each variable with appropriate scope:
   - **Production** - Live site only
   - **Preview** - Preview deployments (staging)
   - **Development** - Local development (rarely used)
   - **All** - All environments (use for non-sensitive vars)

## Validation Checklist

Before deploying, verify:

- [ ] `NEXT_PUBLIC_APP_URL` matches your current domain
- [ ] All Cosmic keys are set and valid
- [ ] RadioCult credentials are configured
- [ ] Stripe keys match environment (test vs live)
- [ ] Stripe webhook URL updated in Stripe Dashboard
- [ ] Cron and revalidation secrets are strong/random
- [ ] Email domain is verified in Resend

## Testing Environment Variables

### Test Cosmic Connection

```bash
curl "https://api.cosmicjs.com/v3/buckets/${BUCKET_SLUG}/objects?read_key=${READ_KEY}&props=id,title&limit=1"
```

### Test Stripe Connection

```bash
curl https://api.stripe.com/v1/customers \
  -u ${STRIPE_SECRET_KEY}: \
  --data-urlencode limit=1
```

### Test App URL

```bash
echo $NEXT_PUBLIC_APP_URL
# Should output: https://worldwidefm.net (or your current domain)
```

## Common Issues

### "Stripe not configured" error

**Cause:** Missing or invalid Stripe keys  
**Fix:** Check all 3 Stripe env vars are set and restart server

### Redirects to wrong domain

**Cause:** `NEXT_PUBLIC_APP_URL` not set or incorrect  
**Fix:** Update to current domain and redeploy

### Webhook 404 errors

**Cause:** Stripe webhook URL doesn't match `NEXT_PUBLIC_APP_URL`  
**Fix:** Update webhook URL in Stripe Dashboard

### Cosmic objects not created

**Cause:** Missing or invalid `COSMIC_WRITE_KEY`  
**Fix:** Verify key in Cosmic dashboard has write permissions

## Security Best Practices

1. **Never commit** `.env.local` to git (already in `.gitignore`)
2. **Rotate secrets** regularly (especially `CRON_SECRET` and `REVALIDATION_SECRET`)
3. **Use test keys** for all non-production environments
4. **Limit API key permissions** in external services
5. **Monitor usage** in Stripe/Cosmic/Resend dashboards

## Need Help?

If environment variables aren't working:

1. Check Vercel deployment logs for "missing variable" errors
2. Verify variable names match exactly (case-sensitive)
3. Restart/redeploy after adding new variables
4. Check that secrets don't have trailing spaces
5. For `NEXT_PUBLIC_*` vars, rebuild the app (not just restart)

---

**Last Updated:** October 2025  
**Maintained By:** Worldwide FM Development Team
