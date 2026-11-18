# InHouseGym — Rent Fitness Equipment at Home

InHouseGym is a gym-equipment rental website. Customers browse treadmills,
cross trainers and exercise bikes, choose a 1, 3 or 6-month rental, and place
an order. Admins manage products, offers, coupons, orders and users from the
admin dashboard. Products, offers, users and rentals stay in sync across all
devices through the backend API.

Live website: https://inhousegym.in

## Project structure

```
frontend/   React + Vite website (customer site + admin dashboard)
backend/    Node.js + Express API, MongoDB Atlas database
```

## Prerequisites

- Node.js 18 or newer
- A free MongoDB Atlas account (for the database)

## Run locally

Use two terminals — one for the backend, one for the frontend.

### 1. Backend (terminal 1)

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Open `.env` and fill in your own values:

- `MONGODB_URI` — your MongoDB Atlas connection string
- `ADMIN_KEY` — any strong secret you choose (the admin dashboard uses
  the same key to talk to the backend)

Check it works: open http://localhost:5000/api/health — it should show
`{"ok":true}`.

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

When the frontend runs on localhost it talks to your local backend
(`http://localhost:5000`). The deployed website talks to the live backend
on Render instead.

## How it works

- **Frontend** (`frontend/src/main.jsx`, `frontend/src/styles.css`) — the
  whole website: home page, product details, cart, checkout, login,
  My Rentals, and the admin dashboard.
- **Backend** (`backend/server.js`) — the API: products, offers, coupons,
  return policy, users, rentals, cart and reviews. Data is stored in
  MongoDB Atlas.
- **Database** — MongoDB Atlas. The backend connects with `MONGODB_URI`
  and reads/writes products, offers, users, rentals and coupons.

## Tech stack

- Frontend: React 18, Vite 5, plain CSS
- Backend: Node.js, Express 4, Mongoose 8
- Database: MongoDB Atlas
- Hosting: Hostinger (frontend), Render (backend)

## Notes

- Never commit a real `.env` file — it holds the database password and
  the admin key. Only `.env.example` (with placeholder values) belongs
  in the repo.
- `node_modules/` and `dist/` are build files and are not committed.
