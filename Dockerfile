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

FROM alpine:3.23 AS runtime
WORKDIR /app

# Copy only the Node.js binary (no npm — eliminates bundled npm vulnerabilities)
COPY --from=node-bin /usr/local/bin/node /usr/local/bin/node

# Create non-root user
RUN addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/false -D node

# Upgrade base packages for security patches, then install Chromium, fonts, and tini
RUN apk upgrade --no-cache \
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
  tini \
  && fc-cache -f

# Install Microsoft Core Fonts manually (no installer on Alpine)
RUN apk add --no-cache --virtual .fetch-deps curl cabextract \
  && mkdir -p /usr/share/fonts/truetype/msttcorefonts \
  && for font in andale32 arial32 arialb32 comic32 courie32 georgi32 impact32 times32 trebuc32 verdan32 webdin32; do \
  curl -sL "https://master.dl.sourceforge.net/project/corefonts/the%20fonts/final/${font}.exe" -o /tmp/${font}.exe \
  && cabextract -q -d /usr/share/fonts/truetype/msttcorefonts /tmp/${font}.exe \
  && rm /tmp/${font}.exe; \
  done \
  && fc-cache -f \
  && apk del .fetch-deps

# Copy build output directly into /app
COPY --from=build /app/build/ ./
COPY --from=deps /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3333
ENV LOG_LEVEL=info
ENV REQUEST_BODY_LIMIT=5mb
ENV RATE_LIMIT_REQUESTS=60
ENV RATE_LIMIT_DURATION="1 minute"
ENV RATE_LIMIT_BLOCK_FOR="5 minutes"
ENV LIMITER_STORE=memory

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3333/health').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"

USER node
EXPOSE 3333
ENTRYPOINT ["tini", "--"]
CMD ["node", "bin/server.js"]
