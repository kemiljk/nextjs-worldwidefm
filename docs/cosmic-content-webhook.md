# Cosmic content webhook

The revalidation endpoint can expire cached content when a Cosmic object changes. This supplements the existing time-based cache expiry, which remains necessary if a webhook is missed. It does not replace the scheduled jobs for weekly shows, cold storage, or Mixcloud archives.

The production bucket has this webhook configured. To verify or recreate it:

1. Ensure `REVALIDATION_SECRET` is configured in the production deployment.
2. In the production Cosmic bucket, open Settings → Webhooks and add an objects webhook pointing to `https://www.worldwidefm.net/api/revalidate`. The bare domain redirects to `www`, which can strip the authorization header.
3. Select created, edited, and deleted events, and leave object types unrestricted so changes to linked content also invalidate the cache. Include `type` and `slug` if restricting payload properties.
4. Add the header `Authorization` with the value `Bearer <REVALIDATION_SECRET>`, using the production secret. Do not put the secret in the URL.
5. Edit a suitable published object and check the deployment logs for a successful revalidation and the relevant tags. Verify the changed content on the site, including a page that uses it as a relationship. Repeat for creation and deletion using suitable test content.

Cosmic documents webhook delivery as fire-and-forget with no retries. A webhook invalidates server caches; a visitor with a page already open may need to navigate or refresh to see the change. API writes only trigger a webhook when the relevant Cosmic operation requests it, so existing application-side invalidation remains in place.

Reference: https://www.cosmicjs.com/learn/rest-api-integrations-and-webhooks
