# ORACLE v2 · Trading Intelligence

> Operational Reconnaissance & Analytical Crypto Logic Engine

Frontend for the ORACLE trading signal engine — built with Next.js 14, React, Tailwind CSS, and SWR. Connects to a local Python/FastAPI backend that runs SMC + VWAP + Anchored Volume Profile analysis.

## Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (semantic design tokens)
- **Data fetching:** SWR (real-time polling)
- **Charts:** lightweight-charts + TradingView iframe
- **Auth:** JWT (stored in localStorage)

## Features

- 📊 **Dashboard** — live KPIs (open setups, win rate, BTC regime)
- 🎯 **Setups** — Positions / Signals / Closed tabs with live P&L
- 🔍 **Screener** — all candidates ranked by confluence score
- 🧪 **Hypotheses** — evidence-based edge tracking
- 📈 **Setup detail** — position overlay chart (entry/SL/TP bands) + TradingView tab
- 🌐 **Sector Strength** — relative strength per sector
- 📰 **News** — market & coin news with sentiment
- ⚡ **Realtime** — WebSocket feed indicator (RT/REST chip in topbar)

## Getting Started

### Prerequisites

- Node.js 18+
- ORACLE backend running on `http://localhost:8000`

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production, set `NEXT_PUBLIC_API_URL` to your backend's public URL (e.g. Cloudflare Tunnel).

## Deployment

Frontend is deployed on **Vercel**. Backend stays on a local machine, exposed via Cloudflare Tunnel.

### Deploy frontend

```bash
npm install -g vercel
vercel --prod
```

Set environment variable in Vercel dashboard:
```
NEXT_PUBLIC_API_URL = https://your-tunnel.trycloudflare.com
```

### Expose local backend

```bash
# Install cloudflared
winget install Cloudflare.cloudflared

# Start tunnel (run every session)
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8000
```

Update `NEXT_PUBLIC_API_URL` in Vercel with the new tunnel URL, then redeploy.

## Project structure

```
src/
├── app/              # Next.js pages (App Router)
│   ├── page.tsx      # Dashboard
│   ├── setups/       # Setups board + detail
│   ├── screener-v2/  # Screener
│   ├── hypotheses/   # Hypothesis registry
│   └── ...
├── components/
│   ├── ui.tsx        # Design system primitives
│   ├── AppShell.tsx  # Sidebar + topbar layout
│   ├── SetupChart.tsx # Position overlay chart
│   └── ...
└── lib/
    └── api.ts        # API helpers + timestamp utils (WIB)
```

## Notes

- All timestamps displayed in **WIB (Asia/Jakarta, UTC+7)**
- Decision-support tool only — not investment advice
- Backend must be running for data to load; frontend shows graceful error states when offline
