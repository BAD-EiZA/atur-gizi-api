# atur-gizi-api

NestJS REST API for Atur Gizi MVP.

## Stack

- NestJS + TypeScript
- Prisma + PostgreSQL (Supabase)
- Kinde JWT (dev bypass when `AUTH_DEV_BYPASS=true` and no issuer)
- Cloudinary signed upload
- Gemini `gemini-3.1-flash-lite` (mock when no API key)

## Setup

```bash
cp .env.example .env
# set DATABASE_URL + DIRECT_URL
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run start:dev
```

API: `http://localhost:4000`  
Swagger: `http://localhost:4000/docs`

## Locked product rules

- Min age 15
- AI quota 10/user/day
- Food photos auto-delete after analysis (default)
- AI draft requires user confirm before food log
