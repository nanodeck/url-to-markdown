# Contributing

Thanks for helping improve URL to Markdown. This guide covers how to set up the project, run checks, and submit changes.

## Prerequisites
- Node.js 20+ (or the version specified by your environment)
- npm (or your preferred package manager)

If Playwright browsers are missing, install Chromium:
```bash
npx playwright install chromium
```

## Setup
```bash
npm install
cp .env.example .env
```

## Run the App
```bash
npm run dev
```

## Run Checks
```bash
npm run lint
npm test
npm run typecheck
```

## Pull Requests
- Keep changes focused and scoped.
- Update or add tests when behavior changes.
- Update documentation when adding or changing configuration and endpoints.
- Ensure checks are passing before requesting review.

## Security Issues
Please report security issues privately. See `SECURITY.md`.
