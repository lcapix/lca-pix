# syntax=docker/dockerfile:1
# Multi-stage build for the LCAPIX Next.js app as a self-contained standalone
# server. Works on AWS App Runner, ECS Fargate, or plain EC2/Docker.
#
#   docker build -t lcapix .
#   docker run -p 3000:3000 --env-file .env.aws lcapix
#
# Runtime env vars required (set in App Runner / ECS task def / EC2):
#   DATABASE_HOST DATABASE_PORT DATABASE_NAME DATABASE_USER DATABASE_PASSWORD
#   JWT_SECRET NEXT_PUBLIC_APP_URL  (+ optional integration API keys)

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

# ---- deps: install with the committed lockfile ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# ---- builder: produce .next/standalone ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV BUILD_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are inlined at build time — pass real values as build args in CI.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
RUN pnpm run build

# ---- runner: minimal runtime image ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# Standalone output already includes the traced node_modules (incl. pdfkit data).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
