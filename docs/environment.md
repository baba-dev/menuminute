# MenuMinute — Environment Configuration Guide

## 1. Overview

MenuMinute uses runtime environment variable validation implemented via **Zod** in `src/lib/config/env.ts`. The application validates all required variables at boot time and fails fast if critical configuration is missing.

Copy `.env.example` to `.env.local` for local development.

---

## 2. Variables Reference

### Core Application (Required)

| Variable       | Description                                               | Default / Example                      |
| -------------- | --------------------------------------------------------- | -------------------------------------- |
| `APP_URL`      | Root public URL of the application (no trailing slash)    | `http://localhost:3000`                |
| `DATABASE_URL` | Relative or absolute path to the SQLite database file     | `./data/menuminute.sqlite`             |
| `AUTH_SECRET`  | NextAuth cryptographic signing key (min 16 chars)         | Generate via `openssl rand -base64 32` |
| `NODE_ENV`     | Runtime environment (`development`, `test`, `production`) | `development`                          |

### AI Providers (Optional — Phase B)

| Variable         | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| `GEMINI_API_KEY` | Google Gemini API key for OCR menu import and text enhancement |
| `NVIDIA_API_KEY` | NVIDIA NIM API key for dish illustration generation            |

### Cloudflare Integration (Optional — Phase B)

| Variable                | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account Identifier                                     |
| `CLOUDFLARE_API_TOKEN`  | API token with Workers AI and R2 permissions                      |
| `R2_ACCESS_KEY_ID`      | S3-compatible R2 storage access key                               |
| `R2_SECRET_ACCESS_KEY`  | S3-compatible R2 storage secret                                   |
| `R2_BUCKET_NAME`        | R2 bucket name (`menuminute-media`)                               |
| `R2_ENDPOINT`           | R2 endpoint URL (`https://<account-id>.r2.cloudflarestorage.com`) |

### Stock Photography (Optional — Phase B)

| Variable         | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `PEXELS_API_KEY` | Pexels API key for curated licensed dish photography |

### Feature Flags

| Variable                   | Default | Purpose                                   |
| -------------------------- | ------- | ----------------------------------------- |
| `AI_FEATURES_ENABLED`      | `false` | Enables AI OCR import and text completion |
| `IMAGE_GENERATION_ENABLED` | `false` | Enables AI dish image generation          |
