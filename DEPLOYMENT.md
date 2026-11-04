# Plugg Admin deployment

Updated 4 November 2026 to Cloudflare Workers (existing account).

- Primary URL: https://admin.plugg.site/admin
- Worker URL: https://plugg-admin.prwxsm.workers.dev
- Backend: https://plugg-92h9.onrender.com
- Version: 47a67f0d-982f-4278-95a3-de8baebca0c3

The custom domain serves the sign-in screen. The gateway snapshot endpoint reaches Render and returns the expected unauthenticated response. Authenticated access and administrative actions still require end-to-end verification. The workers.dev origin is not on the backend login allowlist; use the custom domain to sign in.

Database and R2 credentials stay on Render. No paid plan was enabled. Existing apex and email DNS records were not changed.

## Redeploy

```sh
npm run build
node --test tests/worker.test.mjs
npx wrangler deploy
```

Deployments currently use the local source checkout; automatic GitHub deployment is not configured. Review working-tree changes before publishing updates. Wrangler credentials must never be committed.

Artist verification reviews now appear under Review Queue → Artist verifications. Backend migration 014 must be applied before deploying the corresponding main app. Declines and more-information decisions require artist feedback.
