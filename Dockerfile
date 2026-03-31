FROM node:20-bookworm-slim@sha256:6c51af7dc83f4708aaac35991306bca8f478351cfd2bda35750a62d7efcf05bb AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim@sha256:6c51af7dc83f4708aaac35991306bca8f478351cfd2bda35750a62d7efcf05bb AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine@sha256:4d64b49e6c891c8fc821007cb1cdc6c0db7773110ac2c34bf2e6960adef62ed3 AS node-bin

FROM alpine:3.23@sha256:25109184c71bdad752c8312a8623239686a9a2071e8825f20acb8f2198c3f659 AS runtime
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

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3333/health').then(r=>{if(!r.ok)throw r.status}).catch(()=>process.exit(1))"

USER node
EXPOSE 3333
ENTRYPOINT ["tini", "--"]
CMD ["node", "bin/server.js"]
