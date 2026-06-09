# Sylvia's Surprises — Staff Operations System

Antiques, Collectibles & More  
Memorial Hall, Main Road, Union Mills, IM4 4AD

## Quick Start (Development)

```bash
npm install
npm run dev
```

This starts the Express backend on port 3000 and the Vite dev server on port 5173 with API proxying.

## Production Build

```bash
npm install
npm run build
npm start
```

The app runs on port 3000 (or `PORT` env variable).

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and create a new project
3. Select "Deploy from GitHub repo"
4. Pick this repository
5. Railway auto-detects the Dockerfile and builds
6. Set environment variables:
   - `SESSION_SECRET` — a random string for session encryption
   - `TEST_MODE` — set to `true` for testing, `false` for production
7. Add a custom domain: `sylviassurprises.co.uk`

## DNS Setup (names.co.uk)

After deploying to Railway:
1. In Railway, go to Settings → Domains → Add Custom Domain → `sylviassurprises.co.uk`
2. Railway will give you a CNAME target (e.g. `xxx.up.railway.app`)
3. In names.co.uk DNS settings:
   - Delete any existing A records for `@`
   - Add CNAME: `@` → `xxx.up.railway.app`
   - Add CNAME: `www` → `xxx.up.railway.app`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `SESSION_SECRET` | Session encryption key | dev-secret (change in prod!) |
| `DB_PATH` | SQLite database path | ./data/sylvias.db |
| `TEST_MODE` | Enable test data reset | true in dev, false in prod |

## Test Data Reset

When `TEST_MODE=true`, the Admin area has a "Reset All Test Data" button that clears all tables. 
**Set `TEST_MODE=false` before going live** to disable this.

## Features

35 screens covering: Stock Control, Sales, Invoicing, Customers, Suppliers, Bullion, 
Gift Vouchers, Credit Notes, Expenses, Cash-Up, Takings Reports, P&L, Insurance Register, 
and more. See MANUAL.md for full documentation.
