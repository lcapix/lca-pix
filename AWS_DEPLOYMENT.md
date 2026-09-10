# Deploying LCAPIX to AWS

The database is already on AWS (RDS MySQL `lca_v3`). Only the Next.js app needs
to move off Vercel. This doc covers the three hosting options, the trade-offs,
and the exact steps + env vars for each. Code-side prep is already done:

- `next.config.mjs` emits a standalone server when `BUILD_STANDALONE=1` (no-op on Vercel).
- `Dockerfile` + `.dockerignore` build that standalone server (verified: boots, serves 200, pdfkit fonts traced).
- `amplify.yml` build spec for Amplify Hosting.

---

## Pick your target

| | **Amplify Hosting** | **App Runner** (container) | **EC2** (existing box) |
|---|---|---|---|
| Effort to stand up | Lowest — connect repo, click deploy | Low–medium — push image, create service | Highest — install Node, nginx, PM2, TLS |
| Closest to Vercel | ✅ Yes (git push → deploy) | ⚠️ Needs a CI step to build/push image | ❌ Manual |
| CI/CD | Built-in (per branch) | Auto-deploy on ECR push (configurable) | You wire it (GitHub Actions → SSH) |
| Scaling | Automatic | Automatic (concurrency-based) | Manual (one box) |
| Cost (low traffic) | ~$15–40/mo | ~$25–50/mo (min 1 instance) | Cheapest if box already paid for |
| RDS networking | Public RDS or VPC connector | VPC connector to private RDS | Same VPC = private, simplest security |
| Ops burden | None | Low | You own patching/uptime |
| Best when… | You want Vercel-like with least work | You want containers without managing ECS | You already run things on that EC2 |

**Recommendation:** **Amplify Hosting** — it's the closest drop-in for a Next.js
app already deploying cleanly on Vercel, with the least ops burden. Choose
**App Runner** if you specifically want containers; choose **EC2** only if you
want to consolidate onto the box you already pay for and don't mind managing it.

---

## Required environment variables (all targets)

Set these in the target's env config (Amplify console / App Runner service /
EC2 `.env`). Never commit real secrets.

```
DATABASE_HOST=lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com
DATABASE_PORT=3306
DATABASE_NAME=lca_v3
DATABASE_USER=lcaadmin
DATABASE_PASSWORD=<rds password>
JWT_SECRET=<the production JWT secret — must match existing tokens>
NEXT_PUBLIC_APP_URL=https://<your new domain>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google oauth client id>
GOOGLE_CLIENT_SECRET=<google oauth client secret>
NODE_ENV=production
# Optional — only when you obtain real keys (until then the app uses static
# reference data automatically):
# EIA_API_KEY= ELECTRICITY_MAPS_API_KEY= METALS_API_KEY= BLS_API_KEY=
```

`NEXT_PUBLIC_*` are inlined at build time — for the Docker image pass them as
build args (see Dockerfile); for Amplify they're read from the console at build.

After deploying, update the Google OAuth **Authorized redirect URIs** to the new
domain, or login will fail.

---

## Option A — Amplify Hosting (recommended)

1. AWS Console → **Amplify** → New app → **Host web app** → connect the GitHub repo/branch.
2. Amplify auto-detects `amplify.yml`. Confirm the build settings.
3. **App settings → Environment variables** → add all vars above.
4. Deploy. Amplify gives an `*.amplifyapp.com` URL; add a custom domain under **Domain management**.
5. RDS access: Amplify's SSR compute runs in an AWS-managed VPC. Since this RDS
   is already publicly reachable, it works as-is. To lock it down later, restrict
   the RDS security group and use a VPC connector.

## Option B — App Runner (container)

1. Build + push the image to ECR:
   ```bash
   aws ecr create-repository --repository-name lcapix
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <acct>.dkr.ecr.us-east-1.amazonaws.com
   docker build --build-arg NEXT_PUBLIC_APP_URL=https://<domain> -t lcapix .
   docker tag lcapix <acct>.dkr.ecr.us-east-1.amazonaws.com/lcapix:latest
   docker push <acct>.dkr.ecr.us-east-1.amazonaws.com/lcapix:latest
   ```
2. App Runner → Create service → source = that ECR image → port **3000**.
3. Add env vars above. Set health check path `/`.
4. For private RDS, add a **VPC connector** in the same VPC/subnets as RDS and
   allow the connector's security group in the RDS security group (port 3306).

## Option C — EC2 (existing box, e.g. 35.170.250.110)

1. Install Node 22 + pnpm + nginx on the box.
2. Build the standalone server:
   ```bash
   BUILD_STANDALONE=1 pnpm install --frozen-lockfile && BUILD_STANDALONE=1 pnpm run build
   cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
   ```
3. Run with PM2: `pm2 start .next/standalone/server.js --name lcapix` (env via `.env` or PM2 ecosystem file, `PORT=3000`).
4. nginx reverse-proxy `:443 → 127.0.0.1:3000` with a Let's Encrypt cert.
5. RDS is in the same account; put the EC2 in the RDS VPC/security group for private access on 3306.

---

## Cutover checklist

- [ ] Pick target, provision, set all env vars
- [ ] Confirm DB connectivity from the new host (RDS security group allows it)
- [ ] Update Google OAuth redirect URIs to the new domain
- [ ] Smoke-test: login, open a project, run an assessment, export a PDF
- [ ] Point DNS to the new host (keep Vercel up until verified)
- [ ] Decommission Vercel only after the new host is confirmed healthy
