# দ্রুত সমাধান - Login সমস্যা

## সমস্যা
আপনি logout হয়ে গেছেন এবং login করতে পারছেন না।

## কারণ
Database connection ঠিক আছে, কিন্তু dev server এ সমস্যা হচ্ছে।

## সমাধান (৩টি ধাপ)

### ১. Dev Server বন্ধ করুন
Terminal এ যেখানে `npm run dev` চলছে, সেখানে:
```
Ctrl + C চাপুন
```

### ২. আবার Server চালান
```bash
npm run dev
```

### ৩. Browser এ যান
```
http://localhost:3000/auth/login
```

## যদি এখনও login না হয়

### Option A: Browser Cache Clear করুন
1. Browser এ `Cmd + Shift + Delete` (Mac) বা `Ctrl + Shift + Delete` (Windows)
2. "Cookies and other site data" select করুন
3. Clear data চাপুন
4. আবার login try করুন

### Option B: Incognito/Private Window
1. নতুন Incognito window খুলুন
2. `http://localhost:3000/auth/login` এ যান
3. Login করুন

### Option C: Session Clear করুন
```bash
# Terminal এ এটা চালান:
npx tsx -e "import { prisma } from './lib/prisma.js'; prisma.session.deleteMany().then(() => console.log('✅ All sessions cleared')).catch(e => console.error('❌ Error:', e.message)).finally(() => process.exit())"
```

তারপর আবার login try করুন।

## আমার পরিবর্তন

আমি **কোনো authentication code পরিবর্তন করিনি**। শুধু:
- Health check API এ error handling যোগ করেছি
- Alerts API ঠিক করেছি

এগুলো login এর সাথে সম্পর্কিত নয়।

## Test করুন

Server চালানোর পর এই URL গুলো test করুন:

1. Health check: http://localhost:3000/api/v1/health
2. Login page: http://localhost:3000/auth/login

## সাহায্য

যদি এখনও সমস্যা হয়, আমাকে বলুন:
- কোন error message দেখাচ্ছে?
- Browser console এ কী লেখা আছে? (F12 চাপুন)
- Terminal এ কী error দেখাচ্ছে?
