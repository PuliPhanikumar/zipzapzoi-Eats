# 🚀 ZipZapZoi Eats — Deployment Guide

## Architecture

```
┌──────────────────────────────────────┐
│         PRODUCTION SERVER            │
│                                      │
│  Node.js (Express)                   │
│  ├── /api/*  → Backend API           │
│  ├── /*.html → Frontend Pages        │
│  └── /js/*   → Static Assets         │
│                                      │
│  PostgreSQL ← Prisma ORM             │
│  Razorpay   ← Payment Gateway        │
│  Cloudinary ← Media Storage          │
└──────────────────────────────────────┘
```

**Everything is served from ONE single Node.js process.** The backend serves both the API and the static frontend files.

---

## Option A: Deploy to Railway (Recommended — Easiest)

### Prerequisites
- [Railway Account](https://railway.app) (free tier available)
- GitHub repository

### Steps

**1. Push code to GitHub**
```bash
cd "d:\zipzapzoi\ZipZapZoi Food Delivery\ZipZapZoi Eats Codes"
git init
git add -A
git commit -m "Production ready release"
git remote add origin https://github.com/YOUR_USERNAME/zipzapzoi-eats.git
git push -u origin main
```

**2. Create Railway project**
- Go to [railway.app/new](https://railway.app/new)
- Click **"Deploy from GitHub Repo"**
- Select your repo
- Railway auto-detects the `railway.json` config

**3. Add PostgreSQL database**
- In Railway dashboard, click **"+ New"** → **"Database"** → **"PostgreSQL"**
- Railway auto-creates `DATABASE_URL` env var

**4. Set environment variables**
In Railway Settings → Variables, add:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | *(generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)* |
| `NODE_ENV` | `production` |
| `DEMO_MODE` | `false` |
| `RAZORPAY_KEY_ID` | `rzp_live_xxxxx` |
| `RAZORPAY_KEY_SECRET` | `live_secret_xxxxx` |
| `CORS_ORIGIN` | `https://YOUR_APP.up.railway.app` |

**5. Run database migration**
In Railway's terminal:
```bash
cd backend && npx prisma migrate deploy && node seed.js
```

**6. Your app is live!**
Railway gives you a URL like: `https://zipzapzoi-eats-production.up.railway.app`

---

## Option B: Deploy to Render

### Steps

**1. Push code to GitHub** (same as Railway step 1)

**2. Create Render service**
- Go to [render.com](https://render.com)
- Click **"New" → "Blueprint"**
- Connect your GitHub repo
- Render auto-reads `render.yaml` and creates both the web service and PostgreSQL database

**3. Set environment variables** (same as Railway step 4)

**4. Your app is live!**
Render gives you a URL like: `https://zipzapzoi-eats.onrender.com`

---

## Option C: Deploy with Docker (Any VPS)

### Steps

**1. Build the Docker image**
```bash
docker build -t zipzapzoi-eats .
```

**2. Run with docker-compose** *(create a `docker-compose.yml`)*
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/zipzapzoi
      - JWT_SECRET=your_128_char_secret_here
      - NODE_ENV=production
      - DEMO_MODE=false
      - RAZORPAY_KEY_ID=rzp_live_xxxxx
      - RAZORPAY_KEY_SECRET=live_secret_xxxxx
      - CORS_ORIGIN=https://zipzapzoi.in
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=zipzapzoi
      - POSTGRES_PASSWORD=password
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**3. Start**
```bash
docker-compose up -d
```

---

## Custom Domain Setup

After deploying, to point `zipzapzoi.in` to your app:

1. **Buy domain** from GoDaddy, Namecheap, Google Domains, etc.
2. **Add custom domain** in Railway/Render dashboard
3. **Update DNS** at your registrar:
   - CNAME record: `www` → `your-app.up.railway.app`
   - A record: `@` → provided IP
4. **SSL** is auto-provisioned (both Railway and Render handle this)
5. **Update CORS_ORIGIN** env var to include your domain

---

## Post-Deployment Checklist

- [ ] `DEMO_MODE=false` in env vars
- [ ] Strong `JWT_SECRET` (128 chars)
- [ ] Live Razorpay keys (`rzp_live_*`)
- [ ] CORS_ORIGIN set to your actual domain
- [ ] Database seeded (`node seed.js`)
- [ ] Test the payment flow end-to-end
- [ ] Test the login → order → payment → tracking flow
- [ ] Set up Cloudinary for image uploads (optional)
- [ ] Generate VAPID keys for push notifications
- [ ] Monitor logs for any errors

---

## Monitoring & Logs

- **Railway**: Dashboard → Logs tab (real-time)
- **Render**: Dashboard → Logs tab
- **Docker**: `docker logs zipzapzoi-eats -f`

The backend logs all API errors with method, path, and stack trace in development mode. In production mode, only sanitized error messages are returned to the client.
