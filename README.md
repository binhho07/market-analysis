# SPAtlas

Competitor analysis for local businesses. Search an address, find nearby shops, and compare ratings, prices, and market position.

## Features

- Search competitors by address and radius
- Google Maps view plus heat map
- Price comparison for gel, pedicure, and acrylic
- Charts, grounded AI insights (evidence JSON → LLM), and search history
- Price provenance: each price is Google, website-verified, or estimated, and scores are weighted by confidence
- CSV / PDF export
- JavaScript helpers for recent searches, watchlist, and a market snapshot briefing
- Optional accounts (email or Google)
- Background crawler dashboard at `/crawler`
- Queued analysis pipeline with progress (BullMQ + Redis, in-process fallback)

## Setup

You need Node.js 18+ and a PostgreSQL database. Redis is optional; without it, jobs still run in the Next.js process.

```bash
git clone https://github.com/binhho07/market-analysis.git
cd market-analysis
cp .env.example .env
```

Fill in `.env`, then:

```bash
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Analysis pipeline

`POST /api/analyze` creates an `AnalysisJob` and returns immediately (`202`). A worker then runs:

1. Fetch nearby places
2. Discover websites (concurrency 2, with retries/rate limits)
3. Extract prices
4. Build evidence JSON and generate a grounded market report

Progress is written to PostgreSQL. The UI follows it over SSE (`/api/analyze/:id/events`) and falls back to polling.

### AI insights pipeline

Raw competitor data → deterministic metrics → **Evidence JSON** → optional LLM → grounded report.

Each claim links to a finding in the evidence pack. Click **Why?** in the UI to inspect metrics, method, and source rows. The LLM is constrained to the evidence JSON only; without `OPENAI_API_KEY`, the app falls back to a deterministic summary from the same pack.

Set `REDIS_URL` to use BullMQ (retries, concurrency, idempotency by job key). Without Redis, the same processor runs in-process.

```bash
npm run worker   # optional dedicated BullMQ worker
```

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_MAPS_API_KEY` | Server-side Maps / Places / Geocoding |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser maps |
| `JWT_SECRET` | Email/password auth |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | NextAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in (optional) |
| `BRAVE_SEARCH_API_KEY` | Find salon websites when Google has none |
| `REDIS_URL` | Optional cache, rate limiting, and BullMQ |
| `OPENAI_API_KEY` | Optional grounded LLM report from evidence JSON |
| `OPENAI_MODEL` | Model name (default `gpt-4o-mini`) |

Enable **Maps JavaScript API**, **Places API**, and **Geocoding API** on the Google Cloud key.

## Scripts

```bash
npm run dev          # local server
npm run build        # production build
npm run start        # serve the production build
npm run db:push      # sync Prisma schema to the database
npm run worker        # dedicated BullMQ worker (needs REDIS_URL)
```

## App routes

| Path | What it does |
| --- | --- |
| `/` | Landing page |
| `/analyze` | Run a competitor search |
| `/crawler` | Crawler dashboard |
| `/auth/signin` | Sign in |
| `/auth/signup` | Create an account |

## Stack

Next.js 15, TypeScript, Tailwind CSS 4, Prisma, PostgreSQL, BullMQ, Redis, OpenStreetMap.
