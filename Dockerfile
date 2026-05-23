# syntax=docker/dockerfile:1.7

# ---- Build stage ----
# Native modules (better-sqlite3) need python + build tools.
FROM node:20-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune devDependencies from node_modules before copying to the runtime image.
# Keep the compiled native bindings for better-sqlite3.
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-bookworm-slim AS runtime

ARG SUPERCRONIC_VERSION=v0.2.33
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && curl -fsSLo /usr/local/bin/supercronic \
     "https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
  && chmod +x /usr/local/bin/supercronic \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/sift.db

# Copy built artifacts + pruned node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY crontab /app/crontab
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Fly mounts the persistent volume at /data; make sure the dir exists.
RUN mkdir -p /data

EXPOSE 8080

CMD ["/app/docker-entrypoint.sh"]
