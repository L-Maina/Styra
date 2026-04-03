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

## Step 4: Create Admin User

After the DB schema is pushed, create an admin account. Run this SQL in the **Supabase SQL Editor**:

```sql
-- Hash 'password123' with bcrypt — update with your own hash
INSERT INTO "User" (id, email, "name", role, "isVerified")
VALUES (
  'admin-001',
  'admin@styra.app',
  'Styra Admin',
  'ADMIN',
  true
);
```

Then set a password via your auth flow or Supabase dashboard.

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
