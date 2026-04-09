![CI](https://github.com/nanodeck/url-to-markdown/actions/workflows/ci.yml/badge.svg)
![GitHub Release](https://img.shields.io/github/v/release/nanodeck/url-to-markdown)
![License: MIT](https://img.shields.io/github/license/nanodeck/url-to-markdown)
![Node](https://img.shields.io/badge/node-24-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Patchright](https://img.shields.io/badge/Patchright-Chromium-2EAD33?logo=playwright)
![Docker](https://img.shields.io/badge/ghcr.io-nanodeck%2Furl--to--markdown-blue?logo=docker)
![Trivy](https://img.shields.io/badge/Trivy-0%20vulnerabilities-success?logo=aquasecurity)

# URL to Markdown

Self-hosted API to convert any web page to clean Markdown. Handles JavaScript-rendered sites with headless Chromium, bypasses bot detection, extracts same-domain links, and captures screenshots. Ships as a lightweight Docker image.

## Features

- **HTML to Markdown conversion** — fetches any URL and returns clean Markdown using Readability and Turndown
- **PDF to Markdown conversion** — automatically detects PDF URLs and converts them to Markdown, with optional per-page PNG screenshots
- **JavaScript rendering** — headless Chromium via Patchright for JS-heavy and single-page apps
- **Bot detection evasion** — stealth patches to bypass Cloudflare, DataDome, and other anti-bot systems
- **Screenshot capture** — full-page PNG screenshots with configurable viewport
- **CSS selector extraction** — target specific page elements instead of full-page conversion
- **Link extraction** — returns all same-domain links as structured data
- **SSRF protection** — blocks requests to private IPs and internal networks, with configurable CIDR and hostname allowlists for cluster-internal services
- **Rate limiting** — built-in configurable rate limiter
- **OpenAPI documentation** — interactive Scalar UI at `/api`
- **Multi-arch Docker image** — linux/amd64 and linux/arm64

## Use Cases

- Feed web content into LLMs and RAG pipelines as clean Markdown
- Build web scrapers and crawlers that output structured Markdown
- Archive web pages in a portable, readable format
- Generate Markdown content from JavaScript-rendered single-page apps
- Take automated screenshots of web pages via API

## Quickstart

```bash
docker run \
  -p 3333:3333 \
  -e APP_KEY=$(openssl rand -base64 32) \
  ghcr.io/nanodeck/url-to-markdown:latest
```

With all configuration options:

```bash
docker run \
  -p 3333:3333 \
  -e APP_KEY=$(openssl rand -base64 32) \
  -e HOST=0.0.0.0 \
  -e PORT=3333 \
  -e LOG_LEVEL=info \
  -e APP_URL=http://localhost:3333 \
  -e APP_NAME=url-to-markdown \
  -e REQUEST_BODY_LIMIT=5mb \
  -e RATE_LIMIT_REQUESTS=60 \
  -e RATE_LIMIT_DURATION="1 minute" \
  -e RATE_LIMIT_BLOCK_FOR="5 minutes" \
  -e LIMITER_STORE=memory \
  -e URL_TIMEOUT_MS=30000 \
  -e URL_NAVIGATION_TIMEOUT_MS=30000 \
  -e URL_VIEWPORT_WIDTH=1280 \
  -e URL_VIEWPORT_HEIGHT=720 \
  -e URL_WAIT_UNTIL=load \
  -e SSRF_ALLOWED_CIDRS=10.96.0.0/12 \
  -e SSRF_ALLOWED_HOSTS=pdf-store.internal.svc.cluster.local \
  ghcr.io/nanodeck/url-to-markdown:latest
```

## API

| Method | Path         | Description             |
| ------ | ------------ | ----------------------- |
| GET    | `/`          | Landing page            |
| GET    | `/health`    | Health check            |
| GET    | `/api`       | OpenAPI / Scalar UI     |
| GET    | `/api/fetch` | Convert URL to Markdown |

### GET /api/fetch

Convert a web page to clean Markdown.

**Query Parameters**

| Param               | Required | Default | Description                                                                            |
| ------------------- | -------- | ------- | -------------------------------------------------------------------------------------- |
| `url`               | yes      | —       | URL to convert                                                                         |
| `browser`           | no       | `false` | Use headless Chromium for JS-rendered pages                                            |
| `selector`          | no       | —       | CSS selector to extract specific content (skips Readability)                           |
| `screenshot`        | no       | `false` | Capture a PNG screenshot (implies `browser=true` for HTML; renders each page for PDFs) |
| `screenshot_width`  | no       | `1280`  | Screenshot viewport width in pixels (max: 1920)                                        |
| `screenshot_height` | no       | `720`   | Screenshot viewport height in pixels (max: 1080; ignored for PDFs)                     |

**Example — HTML**

```bash
curl 'http://localhost:3333/api/fetch?url=https://example.com'
```

```json
{
  "url": "https://example.com/",
  "title": "Example Domain",
  "markdown": "# Example Domain\n\nThis domain is for use in...",
  "links": [{ "url": "https://example.com/about", "text": "About", "rel": null }]
}
```

**Example — PDF**

```bash
curl 'http://localhost:3333/api/fetch?url=https://example.com/report.pdf'
```

```json
{
  "url": "https://example.com/report.pdf",
  "title": null,
  "markdown": "# Report Title\n\nExtracted text from the PDF...",
  "links": []
}
```

With per-page screenshots:

```bash
curl 'http://localhost:3333/api/fetch?url=https://example.com/report.pdf&screenshot=true'
```

```json
{
  "url": "https://example.com/report.pdf",
  "title": null,
  "markdown": "...",
  "links": [],
  "screenshots": ["iVBORw0KGgo...(base64 PNG page 1)", "iVBORw0KGgo...(page 2)"]
}
```

**Response Codes**

| Status | Description                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| 200    | Success — returns `url`, `title`, `markdown`, `links`, and optionally `screenshot` (HTML) or `screenshots` (PDF) |
| 403    | SSRF blocked — private/internal IPs and `file:`/`data:` protocols are rejected                                   |
| 415    | Unsupported content type — the URL points to a non-HTML, non-PDF resource                                        |
| 422    | Validation error — missing or invalid `url` parameter                                                            |
| 4xx    | Upstream non-success status forwarded from the target URL                                                        |
| 502    | Connection failure — DNS error, timeout, or unreachable host                                                     |

**Notes**

- Content type is auto-detected via HEAD request, with magic-byte sniffing as fallback for `application/octet-stream` responses
- `links` contains same-domain links only (external links are excluded), resolved to absolute URLs
- `screenshot` (singular) is a base64-encoded PNG for HTML pages, only present when `screenshot=true`
- `screenshots` (plural) is an array of base64-encoded PNGs for PDF pages, only present when `screenshot=true` on a PDF URL
- `title` may be `null` (always `null` for PDFs)

## Bot Detection Evasion

When `browser=true`, the service uses [Patchright](https://github.com/niceboredom/patchright) (a patched Playwright fork) with additional stealth measures to avoid being blocked by anti-bot systems:

- Patchright protocol-level patches (removes automation flags, disables `Runtime.enable` leak)
- `navigator.webdriver` hidden
- Realistic `navigator.plugins`, `languages`, and `hardwareConcurrency`
- `chrome.runtime` spoofed to appear as a real Chrome browser
- Notifications permission query patched
- WebGL vendor/renderer fingerprint spoofed
- Chrome-like User-Agent string (no "Headless" marker)

No configuration needed — all evasions are applied automatically when using browser mode.

## Docker

```bash
docker pull ghcr.io/nanodeck/url-to-markdown:latest
docker run -p 3333:3333 -e APP_KEY=$(openssl rand -base64 32) -e NODE_ENV=production ghcr.io/nanodeck/url-to-markdown:latest
```

To build locally:

```bash
docker build -t url-to-markdown:latest .
```

## Helm Chart (Kubernetes)

```bash
helm install url-to-markdown oci://ghcr.io/nanodeck/charts/url-to-markdown --version 0.1.0 \
  -n url-to-markdown --create-namespace \
  --set appKey=$(openssl rand -base64 32)
```

With a custom values file:

```bash
helm install url-to-markdown oci://ghcr.io/nanodeck/charts/url-to-markdown --version 0.1.0 \
  -n url-to-markdown --create-namespace \
  -f k8s/helm-values-example.yaml
```

The chart includes: Deployment, Service, ConfigMap, Secret, ServiceAccount, and an optional HorizontalPodAutoscaler. See [values.yaml](charts/url-to-markdown/values.yaml) for all configurable options and [k8s/helm-values-example.yaml](k8s/helm-values-example.yaml) for a production-like example.

To enable autoscaling:

```bash
helm install url-to-markdown oci://ghcr.io/nanodeck/charts/url-to-markdown --version 0.1.0 \
  -n url-to-markdown --create-namespace \
  --set appKey=$(openssl rand -base64 32) \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=2 \
  --set autoscaling.maxReplicas=10
```

A raw manifest example (without Helm) is also available at [k8s/deployment.example.yaml](k8s/deployment.example.yaml).

## Configuration

All config is env-driven. See `.env.example` for available settings.

### General

| Variable             | Default                 | Description                                        |
| -------------------- | ----------------------- | -------------------------------------------------- |
| `TZ`                 | `UTC`                   | Server timezone                                    |
| `PORT`               | `3333`                  | HTTP port                                          |
| `HOST`               | `0.0.0.0`               | Bind address                                       |
| `LOG_LEVEL`          | `info`                  | Log level                                          |
| `APP_KEY`            | —                       | Encryption key (required, `node ace generate:key`) |
| `NODE_ENV`           | `development`           | Environment (`development`, `production`, `test`)  |
| `APP_URL`            | `http://localhost:3333` | Public-facing URL                                  |
| `APP_NAME`           | `url-to-markdown`       | Application name                                   |
| `APP_VERSION`        | `0.0.0`                 | Application version                                |
| `APP_ENV`            | `development`           | Application environment                            |
| `REQUEST_BODY_LIMIT` | `5mb`                   | Max request body size                              |

### Rate Limiting

| Variable               | Default     | Description                         |
| ---------------------- | ----------- | ----------------------------------- |
| `RATE_LIMIT_REQUESTS`  | `60`        | Max requests per window             |
| `RATE_LIMIT_DURATION`  | `1 minute`  | Rate limit window duration          |
| `RATE_LIMIT_BLOCK_FOR` | `5 minutes` | Block duration after limit exceeded |
| `LIMITER_STORE`        | `memory`    | Limiter backend (`memory`)          |

### SSRF Protection

| Variable             | Default | Description                                                                                   |
| -------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `SSRF_ALLOWED_CIDRS` | —       | Comma-separated CIDRs to exempt from private-IP blocking (e.g., `10.96.0.0/12,10.244.0.0/16`) |
| `SSRF_ALLOWED_HOSTS` | —       | Comma-separated hostnames to exempt from SSRF checks (e.g., `pdf-store.ns.svc.cluster.local`) |

By default, all private/internal IP ranges are blocked. When deploying in Kubernetes, cluster service IPs often fall in private ranges (e.g., `10.96.0.0/12`). Use these env vars to allow access to trusted internal services while keeping SSRF protection for everything else. Protocol blocks (`file:`, `data:`, `ftp:`, `gopher:`) are never bypassed by allowlists.

### Browser / Fetch

| Variable                    | Default | Description                                               |
| --------------------------- | ------- | --------------------------------------------------------- |
| `URL_TIMEOUT_MS`            | `30000` | Default page timeout (ms)                                 |
| `URL_NAVIGATION_TIMEOUT_MS` | `30000` | Navigation timeout (ms)                                   |
| `URL_VIEWPORT_WIDTH`        | `1280`  | Default browser viewport width                            |
| `URL_VIEWPORT_HEIGHT`       | `720`   | Default browser viewport height                           |
| `URL_WAIT_UNTIL`            | `load`  | Wait strategy (`load`, `domcontentloaded`, `networkidle`) |

## Development

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start            # Run production server
npm test             # Run all tests
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```

## Also by Nanodeck

| Project                                                | Description                                                                                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [html-to-pdf](https://github.com/nanodeck/html-to-pdf) | Self-hosted API to convert HTML to high-quality PDF documents using headless Chromium. Supports thumbnails, file storage, and MCP tool for AI agent workflows. |

## License

MIT
