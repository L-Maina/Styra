# Styra — Deployment Guide (Vercel)

## Prerequisites
- GitHub repo: `L-Maina/Styra`
- Supabase PostgreSQL database (already configured)
- Vercel account (free tier works)

---

## Step 1: Push Database Schema to Supabase

Run this **once** from your local machine (not from Vercel):

```bash
cd Styra

# Using the DIRECT_URL for schema push (port 5432)
# Replace with your actual Supabase direct connection string
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
npx prisma db push
```

This creates all tables (User, Business, Service, Booking, Payment, etc.) in your Supabase database.

---

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Easiest)
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `L-Maina/Styra` from GitHub
3. Click **Deploy** (build will use `prisma generate && next build`)

### Option B: Via Vercel CLI
```bash
npm i -g vercel
vercel --prod
```

---

## Step 3: Set Environment Variables on Vercel

Go to your Vercel project → **Settings** → **Environment Variables**.

Copy these **exactly** (replace empty values when you have them):

```env
# Required — replace [YOUR_VALUES] with your actual credentials
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
JWT_SECRET=[your-jwt-secret]

# App
NEXT_PUBLIC_APP_URL=https://styra.app
NEXTAUTH_URL=https://styra.app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=[your-cloud-name]
CLOUDINARY_API_KEY=[your-key]
CLOUDINARY_API_SECRET=[your-secret]

# Pusher
PUSHER_APP_ID=[your-app-id]
NEXT_PUBLIC_PUSHER_KEY=[your-key]
PUSHER_SECRET=[your-secret]
NEXT_PUBLIC_PUSHER_CLUSTER=eu

# JWT Config
JWT_EXPIRES_IN=7d
JWT_ISSUER=styra

# CORS
CORS_ORIGINS=https://styra.app
```

After setting vars, **redeploy**:
- Vercel Dashboard → Deployments → Redeploy
- Or `vercel --prod`

---

## Step 4: Seed Admin User & Demo Data

After deploying, you need to create the admin user in your Supabase database. You have **two options**:

### Option A: Use the Setup API Endpoint (Easiest)

After deploying to Vercel, visit your app URL and send a POST request:

```bash
# Replace YOUR_APP_URL with your Vercel URL
curl -X POST https://YOUR_APP_URL/api/setup
```

Or open it in your browser's developer console:
```js
fetch('/api/setup', { method: 'POST' }).then(r => r.json()).then(console.log)
```

This creates:
- **Admin user**: `admin@styra.app` / `password123`
- **Business owner**: `jane@styleshop.co.ke` / `password123`
- **Customer**: `john@example.com` / `password123`
- 3 demo businesses with services and staff

> **Security note**: This endpoint is idempotent (safe to run multiple times). After setup, consider deleting `src/app/api/setup/route.ts` and redeploying.

### Option B: Run Seed Script Locally

```bash
# Set your Supabase connection string
export DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Run the seed
cd Styra
npx tsx prisma/seed.ts
```

### Option C: Supabase SQL Editor

Run this SQL in the **Supabase SQL Editor** (Dashboard → SQL Editor → New Query):

```sql
-- Enable pgcrypto for bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create admin user with bcrypt-hashed password ('password123')
INSERT INTO "User" (id, email, "name", password, role, "isVerified", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@styra.app',
  'Admin User',
  crypt('password123', gen_salt('bf')),
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;
```

> **Change the password**: Replace `'password123'` with your desired password.

---

## Step 5: Access the Admin Dashboard

1. Go to your deployed app URL
2. Click **Sign In** in the navigation bar
3. Enter `admin@styra.app` as the email
4. Enter `password123` as the password
5. Click **Sign In**

You'll be **automatically redirected to the Admin Dashboard**. The app detects the `admin` role and routes you there directly.

### What the Admin Dashboard includes:
- **Overview**: Platform stats (users, bookings, revenue)
- **Users**: Manage all user accounts (view, ban, promote)
- **Businesses**: Approve/reject business listings
- **Disputes**: Resolve booking disputes
- **Monitoring**: Security alerts and system health
- **Analytics**: Platform performance metrics

### Other Test Accounts:
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@styra.app | password123 |
| Business Owner | jane@styleshop.co.ke | password123 |
| Customer | john@example.com | password123 |

---

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│  Vercel     │─────▶│  Supabase    │─────▶│  PostgreSQL     │
│  (Next.js)  │      │  (Pooler)    │      │  (Database)     │
│             │      │  Port 6543   │      │  Port 5432      │
└─────────────┘      └──────────────┘      └─────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────┴────┐  ┌────┴────┐  ┌─────┴─────┐
        │ Cloudinary│  │ Pusher  │  │ Stripe/   │
        │ (Images) │  │ (Real-  │  │ M-Pesa/   │
        │          │  │  time)  │  │ PayPal    │
        └──────────┘  └─────────┘  └───────────┘
```

- **DATABASE_URL** (pooler, 6543): Used by Vercel serverless functions at runtime
- **DIRECT_URL** (direct, 5432): Used only for `prisma db push` migrations

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails "prisma generate" | Ensure `DATABASE_URL` is set on Vercel |
| P1001 "Can't reach database" | Use pooler URL (6543) for runtime, direct (5432) for migrations |
| API routes return 500 | Check Vercel Function Logs |
| White screen / blank page | Check browser console for errors, verify DATABASE_URL |
