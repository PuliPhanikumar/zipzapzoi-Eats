# ZipZapZoi Eats — Food Delivery Platform

A full-stack food delivery platform with customer app, restaurant partner portal, rider dashboard, and admin console.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, Tailwind CSS, Vanilla JavaScript (PWA) |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL + Prisma ORM |
| **Payments** | Razorpay |
| **Real-time** | Socket.IO |
| **Auth** | JWT + Google OAuth |
| **File Uploads** | Cloudinary (fallback: local) |
| **Push Notifications** | Web-Push (VAPID) |

## Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database URL, API keys, etc.
```

### 3. Setup Database
```bash
# Make sure PostgreSQL is running
npx prisma migrate dev --name init
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Open Frontend
Open `index.html` in a browser, or serve with VS Code Live Server / any static server.

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@zipzapzoi.in | admin123 |
| Customer | customer@zipzapzoi.in | customer123 |
| Partner | partner@zipzapzoi.in | partner123 |
| Rider | rider@zipzapzoi.in | rider123 |

## API Base URL

- Development: `http://localhost:5000/api`
- Production: Set `CORS_ORIGIN` in `.env`

## Project Structure

```
ZipZapZoi Eats/
├── backend/
│   ├── index.js              # Main API server
│   ├── seed.js               # Database seeder
│   ├── notifications.js      # Email/SMS service
│   ├── uploadService.js      # Media upload service
│   ├── middleware/
│   │   ├── auth.js           # JWT verification & RBAC
│   │   ├── validate.js       # Input validation
│   │   └── errorHandler.js   # Error handling
│   └── prisma/
│       └── schema.prisma     # Database models
├── js/
│   ├── zoi_config.js         # Frontend API config & auth
│   ├── db_simulation.js      # Mock data + backend sync
│   ├── zoi_customer_engine.js # Customer UI logic
│   ├── zoi_partner_engine.js  # Partner/POS logic
│   ├── zoi_theme.js          # Theme & navigation
│   ├── zoi_location.js       # Geolocation service
│   └── zoi_ai_assistant.js   # AI chat assistant
├── sw.js                     # Service Worker (PWA)
├── manifest.json             # PWA manifest
└── *.html                    # 120+ pages
```

## Deployment

### Render / Railway
1. Set environment variables in dashboard
2. Build command: `cd backend && npm install && npx prisma migrate deploy`
3. Start command: `cd backend && npm start`

### Docker (Coming Soon)
```bash
docker-compose up -d
```
