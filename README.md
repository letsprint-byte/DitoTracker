# DitoTracker

DITO Sales & Retailer Management System — MVP. Centralized web app for a small DITO distribution business (admin + sales agents) to manage retailers, sales, load requests, collections, and inventory.

## Stack

- **Server:** Node.js + Express + PostgreSQL, JWT auth, bcrypt, multer (file uploads), node-cron (reminders)
- **Client:** React (Vite), React Router, TanStack Query, Tailwind CSS, Axios

## Setup

### 1. Database

```bash
createdb ditotracker
```

### 2. Server

```bash
cd server
cp .env.example .env   # edit DATABASE_URL / JWT_SECRET as needed
npm install
npm run migrate         # creates schema
npm run seed             # creates demo users + products
npm run dev               # http://localhost:4000
```

Seeded logins (password `password123` for all):

- `admin@dito.local` — admin
- `agent1@dito.local` / `agent2@dito.local` — sales agents

### 3. Client

```bash
cd client
cp .env.example .env    # set VITE_API_URL if server isn't on localhost:4000
npm install
npm run dev               # http://localhost:5173
```

## Feature coverage

- Auth with JWT + role-based access (admin / agent)
- Retailer CRUD, profile, purchase history timeline
- Sales recording with automatic agent-inventory deduction and retailer balance updates
- Load request lifecycle: pending → approved → released → received (or rejected), with stock movement between main and agent inventory
- Payments/collections with proof-of-payment image upload, retailer balance tracking
- Main + per-agent inventory views, manual transfer, full stock movement log, low-stock notifications
- Auto-generated monthly load reminders (cron + on-demand), list view with done/snooze/dismiss
- In-app notification bell (load requests, payments, low stock, reminders)
- Role-aware dashboards (admin: cross-agent totals + performance; agent: own totals + reminders)
- CSV-exportable reports: sales, collections, retailers, inventory, agent performance
- Admin agent (user) management
