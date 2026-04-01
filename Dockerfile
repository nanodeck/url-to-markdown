FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS node-bin

FROM node:20-bookworm-slim AS fonts
RUN sed -i 's/^Components: main$/Components: main contrib/' /etc/apt/sources.list.d/debian.sources \
  && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
  && apt-get update \
  && apt-get install -y --no-install-recommends ttf-mscorefonts-installer \
  && rm -rf /var/lib/apt/lists/*

FROM alpine:3.23 AS runtime
WORKDIR /app

# Copy only the Node.js binary (no npm — eliminates bundled npm vulnerabilities)
COPY --from=node-bin /usr/local/bin/node /usr/local/bin/node

# Create non-root user, upgrade base packages, and install Chromium, fonts, and tini
RUN addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/false -D node \
  && apk upgrade --no-cache \
  && apk add --no-cache \
  libstdc++ \
  chromium \
  font-liberation \
  font-noto \
  font-noto-cjk \
  font-noto-emoji \
  fontconfig \
  freetype \
  harfbuzz \
  nss \
  tini

# Copy Microsoft Core Fonts from Debian-based stage (avoids flaky SourceForge downloads on Alpine)
COPY --from=fonts /usr/share/fonts/truetype/msttcorefonts /usr/share/fonts/truetype/msttcorefonts
RUN fc-cache -f

# Copy build output directly into /app
COPY --from=build /app/build/ ./
COPY --from=deps /app/node_modules ./node_modules

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    LOG_LEVEL=info \
    REQUEST_BODY_LIMIT=5mb \
    RATE_LIMIT_REQUESTS=60 \
    RATE_LIMIT_DURATION="1 minute" \
    RATE_LIMIT_BLOCK_FOR="5 minutes" \
    LIMITER_STORE=memory \
    CHROMIUM_PATH=/usr/bin/chromium-browser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3333/health').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"

USER node
EXPOSE 3333
ENTRYPOINT ["tini", "--"]
CMD ["node", "bin/server.js"]
