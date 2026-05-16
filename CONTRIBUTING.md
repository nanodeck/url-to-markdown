# Contributing

Thanks for helping improve URL to Markdown. This guide covers how to set up the project, run checks, and submit changes.

## Prerequisites

- Node.js 24+ (see `.node-version`)
- pnpm 10+ (run `corepack enable` to use the version pinned in `package.json`)

If Patchright browsers are missing, install Chromium:

```bash
pnpm exec patchright install chromium
```

## Setup

```bash
pnpm install
cp .env.example .env
```

## Run the App

```bash
pnpm dev
```

## Run Checks

```bash
pnpm lint
pnpm test
pnpm typecheck
```

## Pull Requests

- Keep changes focused and scoped.
- Update or add tests when behavior changes.
- Update documentation when adding or changing configuration and endpoints.
- Ensure checks are passing before requesting review.

## Security Issues

Please report security issues privately. See `SECURITY.md`.
