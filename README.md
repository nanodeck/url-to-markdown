# URL to Markdown

Convert web pages to clean Markdown using Playwright and Chromium.

## Quickstart

```bash
npm install
cp .env.example .env
# Generate APP_KEY: node ace generate:key
npm run dev
```

## API

| Method | Path       | Description         |
| ------ | ---------- | ------------------- |
| GET    | `/`        | Landing page        |
| GET    | `/health`  | Health check        |
| GET    | `/api`     | OpenAPI / Scalar UI |
| GET    | `/api/fetch` | Convert URL to Markdown |

### GET /api/fetch

Convert a web page to clean Markdown.

**Query Parameters**

| Param              | Required | Default | Description                                                   |
|--------------------|----------|---------|---------------------------------------------------------------|
| `url`              | yes      | —       | URL to convert                                                |
| `browser`          | no       | `false` | Use headless Chromium for JS-rendered pages                   |
| `selector`         | no       | —       | CSS selector to extract specific content (skips Readability)  |
| `screenshot`       | no       | `false` | Capture a PNG screenshot (implies `browser=true`)             |
| `screenshot_width` | no       | `1280`  | Screenshot viewport width in pixels (max: 1920)               |
| `screenshot_height`| no       | `720`   | Screenshot viewport height in pixels (max: 1080)              |

**Example**

```bash
curl 'http://localhost:3333/api/fetch?url=https://example.com'
```

```json
{
  "url": "https://example.com/",
  "title": "Example Domain",
  "markdown": "# Example Domain\n\nThis domain is for use in...",
  "links": [
    { "url": "https://example.com/about", "text": "About", "rel": null }
  ]
}
```

**Response Codes**

| Status | Description |
|--------|-------------|
| 200    | Success — returns `url`, `title`, `markdown`, `links`, and optionally `screenshot` |
| 403    | SSRF blocked — private/internal IPs and `file:`/`data:` protocols are rejected |
| 422    | Validation error — missing or invalid `url` parameter |
| 4xx    | Upstream non-success status forwarded from the target URL |
| 502    | Connection failure — DNS error, timeout, or unreachable host |

**Notes**
- `links` contains same-domain links only (external links are excluded), resolved to absolute URLs
- `screenshot` is a base64-encoded PNG, only present when `screenshot=true`
- `title` may be `null` if the page has no title element

## Development

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start            # Run production server
npm test             # Run all tests
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```

## Docker

```bash
docker build -t url-to-markdown:latest .
docker run -p 3333:3333 -e APP_KEY=testtesttesttesttest -e NODE_ENV=production url-to-markdown:latest
```

## Configuration

All config is env-driven. See `.env.example` for available settings.

### General

| Variable             | Default                   | Description                          |
|----------------------|---------------------------|--------------------------------------|
| `TZ`                 | `UTC`                     | Server timezone                      |
| `PORT`               | `3333`                    | HTTP port                            |
| `HOST`               | `0.0.0.0`                | Bind address                         |
| `LOG_LEVEL`          | `info`                    | Log level                            |
| `APP_KEY`            | —                         | Encryption key (required, `node ace generate:key`) |
| `NODE_ENV`           | `development`             | Environment (`development`, `production`, `test`) |
| `APP_URL`            | `http://localhost:3333`   | Public-facing URL                    |
| `APP_NAME`           | `url-to-markdown`         | Application name                     |
| `APP_VERSION`        | `0.0.0`                   | Application version                  |
| `APP_ENV`            | `development`             | Application environment              |
| `REQUEST_BODY_LIMIT` | `5mb`                     | Max request body size                |

### Rate Limiting

| Variable              | Default      | Description                          |
|-----------------------|--------------|--------------------------------------|
| `RATE_LIMIT_REQUESTS` | `60`         | Max requests per window              |
| `RATE_LIMIT_DURATION` | `1 minute`   | Rate limit window duration           |
| `RATE_LIMIT_BLOCK_FOR`| `5 minutes`  | Block duration after limit exceeded  |
| `LIMITER_STORE`       | `memory`     | Limiter backend (`memory`)           |

### Browser / Fetch

| Variable                   | Default | Description                              |
|----------------------------|---------|------------------------------------------|
| `URL_TIMEOUT_MS`           | `30000` | Default page timeout (ms)                |
| `URL_NAVIGATION_TIMEOUT_MS`| `30000` | Navigation timeout (ms)                  |
| `URL_VIEWPORT_WIDTH`       | `1280`  | Default browser viewport width           |
| `URL_VIEWPORT_HEIGHT`      | `720`   | Default browser viewport height          |
| `URL_WAIT_UNTIL`           | `load`  | Wait strategy (`load`, `domcontentloaded`, `networkidle`) |

### Observability

| Variable                      | Default            | Description                     |
|-------------------------------|--------------------|---------------------------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | —                  | OpenTelemetry collector endpoint |
| `OTEL_EXPORTER_OTLP_HEADERS`  | —                  | OTLP exporter headers           |
| `OTEL_SERVICE_NAME`           | `url-to-markdown`  | OTLP service name               |

## License

MIT
