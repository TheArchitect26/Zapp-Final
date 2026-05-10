# Zapp Money

A fintech platform for digital wallets, P2P transfers, top-ups, withdrawals, KYC, and earn rewards — built on React + Vite (frontend) and Node.js + Express + Supabase (backend).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js 24, Express 5, Socket.IO |
| Database | Supabase (PostgreSQL + RLS + Realtime) |
| Payments | Peach Payments (top-up, payouts) |
| KYC | Smile Identity |
| Push | Web Push (VAPID) |
| ML | Python FastAPI microservice (fraud scoring) |
| Deploy | Docker, Railway (backend), Vercel (frontend) |

---

## Prerequisites

- Node.js 24+
- A [Supabase](https://supabase.com) project
- (Optional) [Peach Payments](https://peachpayments.com) account for top-up/withdrawal
- (Optional) [Smile Identity](https://smileidentity.com) account for KYC

---

## Local Setup

**1. Clone and install**
```bash
git clone https://github.com/msarhcy/Zapp-v3.git
cd Zapp-v3/Zapp-money-round4-fixed
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL,
# VITE_SUPABASE_PUBLISHABLE_KEY, WEBHOOK_SECRET, and any payment keys
```

**3. Apply database migrations**
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

**4. Run frontend (dev)**
```bash
npm run dev        # http://localhost:5173
```

**5. Run backend**
```bash
node src/server.js # http://localhost:3000
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (frontend) |
| `npm run build` | Production frontend build → `dist/` |
| `npm start` | Start Express backend |
| `npm test` | Run unit tests (vitest) |
| `npm run lint` | ESLint |

---

## Environment Variables

See [`.env.example`](.env.example) for the full list. Required at minimum:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (backend only, never expose to browser) |
| `VITE_SUPABASE_URL` | Supabase project URL (frontend) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (frontend) |
| `VITE_API_BASE_URL` | Backend URL as seen from the browser |
| `WEBHOOK_SECRET` | HMAC secret for verifying incoming webhooks |
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated |

---

## Deployment

### Frontend → Vercel

1. Import the repo on [vercel.com](https://vercel.com)
2. Set root directory to `Zapp-money-round4-fixed`
3. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` as environment variables
4. Deploy

### Backend → Railway

1. Create a new project on [railway.app](https://railway.app)
2. Connect this repo, set root to `Zapp-money-round4-fixed`
3. Railway will detect `railway.toml` and build the Dockerfile automatically
4. Add all backend env vars from `.env.example`
5. Deploy

### Backend → Docker

```bash
docker build -t zapp-backend .
docker run -p 3000:3000 --env-file .env zapp-backend
```

---

## Architecture

```
Browser
  └── React (Vite)
        ├── Supabase JS client  ──► Supabase (auth, realtime, direct reads)
        └── fetch (store.ts)    ──► Express backend
                                      ├── /api/v1/transfer   (fraud + RPC)
                                      ├── /api/v1/topup      (Peach checkout)
                                      ├── /api/v1/withdraw   (Peach payout)
                                      ├── /api/v1/kyc        (Smile Identity)
                                      ├── /api/v1/webhooks   (Peach + Smile)
                                      └── /api/v1/admin      (admin only)
```

All financial writes go through the backend. Direct Supabase reads (balance, transactions, profile) go through the JS client with RLS enforced.

---

## CI

GitHub Actions runs on every push to `main`:
- ESLint
- Vitest (27 tests)
- Vite build

Docker image is built and pushed to `ghcr.io/msarhcy/Zapp-v3/backend` on every successful push to `main`.
