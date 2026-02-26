# ---- Stage 1: Dependencies ----
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ && \
    printf "onlyBuiltDependencies:\n  - better-sqlite3\n  - cpu-features\n  - ssh2\n" > pnpm-workspace.yaml && \
    pnpm install --frozen-lockfile && \
    pnpm rebuild better-sqlite3 && \
    apk del .build-deps

# ---- Stage 2: Build ----
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure public directory exists for standalone output
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- Stage 3: Runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output (requires output: 'standalone' in next.config.ts)
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
