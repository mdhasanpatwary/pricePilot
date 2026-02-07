# Login Issue Fix - Database Connection Problem

## সমস্যা (Problem)
আপনি logout হয়ে গেছেন এবং login করতে পারছেন না।

## কারণ (Root Cause)
Database connection failed: `Can't reach database server at base`

এটা আমার code changes এর কারণে হয়নি। এটা Neon database connection issue।

## সমাধান (Solution)

### ১. Dev Server Restart করুন

```bash
# Terminal এ Ctrl+C চাপুন (যদি server চলছে)
# তারপর আবার চালান:
npm run dev
```

### ২. Database Connection Test করুন

```bash
npx prisma db pull
```

যদি এটা কাজ করে, তাহলে database connection ঠিক আছে।

### ৩. Neon Database Wake Up করুন

Neon free tier database sleep mode এ যায়। Wake up করতে:

1. Neon Console এ যান: https://console.neon.tech/
2. আপনার project select করুন
3. Database status দেখুন
4. যদি "Sleeping" দেখায়, তাহলে কোনো query run করুন

অথবা এই command চালান:

```bash
npx tsx -e "import { prisma } from './lib/prisma.js'; prisma.\$queryRaw\`SELECT 1\`.then(() => console.log('✅ Database awake')).catch(e => console.error('❌ Error:', e.message)).finally(() => process.exit())"
```

### ৪. যদি এখনও কাজ না করে

Database URL check করুন:

```bash
# .env file এ DATABASE_URL ঠিক আছে কিনা দেখুন
cat .env | grep DATABASE_URL
```

Expected format:
```
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

### ৫. Emergency: Local Database Use করুন (Optional)

যদি Neon database down থাকে, temporary local database use করতে পারেন:

```bash
# Install PostgreSQL locally (if not installed)
# macOS:
brew install postgresql@14
brew services start postgresql@14

# Create local database
createdb pricepilot_local

# Update .env
DATABASE_URL="postgresql://localhost:5432/pricepilot_local"

# Run migrations
npx prisma migrate deploy

# Seed data
npx prisma db seed
```

## আমার Changes কী ছিল?

আমি শুধু এই files পরিবর্তন করেছি:

1. `lib/services/system-health.ts` - Error handling উন্নত করেছি
2. `app/api/v1/admin/alerts/route.ts` - Alert data format ঠিক করেছি
3. `app/api/v1/admin/alerts/[id]/acknowledge/route.ts` - Already existed
4. `app/api/v1/admin/health/route.ts` - Already existed
5. `app/api/v1/admin/diagnostics/route.ts` - Already existed

**কোনো authentication, session, বা database connection code পরিবর্তন করিনি!**

## Quick Test

Server restart করার পর এই URL এ যান:

```
http://localhost:3000/api/v1/health
```

যদি এটা response দেয়, তাহলে database connection ঠিক আছে।

## Login Credentials

যদি আপনার credentials মনে না থাকে:

```bash
# Check existing users
npx tsx debug-login.ts

# Reset admin password (if needed)
npx tsx scripts/reset-admin-password.ts your@email.com newpassword
```

## সাহায্য দরকার?

যদি এখনও সমস্যা হয়, আমাকে বলুন:
1. কোন error message দেখাচ্ছে?
2. Browser console এ কী error আছে?
3. `npm run dev` চালালে কী output আসছে?
