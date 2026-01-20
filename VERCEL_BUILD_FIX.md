# Fixing Vercel Build Error: "Tenant or user not found"

## Problem
The build works locally but fails on Vercel with:
```
Error [DriverAdapterError]: Tenant or user not found
    at F.onError (.next/server/chunks/ssr/_147aad7c._.js:1:11622)
> Build error occurred
Error: Failed to collect page data for /blog/[slug]
```

## Root Cause
Vercel has cached an old build that references a `/blog/[slug]` route that no longer exists in the application.

## Solutions

### Solution 1: Clear Vercel Build Cache (Recommended)

1. Go to your Vercel Dashboard
2. Navigate to your project
3. Go to "Deployments" tab
4. Find the latest deployment
5. Click the three dots menu (⋮) and select "Redeploy"
6. **Important:** Check the box "Clear build cache and redeploy"
7. Click "Redeploy"

### Solution 2: Force New Deployment via Git

If Solution 1 doesn't work, force a fresh deployment:

```bash
# Make a trivial change to force rebuild
git commit --allow-empty -m "chore: force vercel rebuild"
git push
```

### Solution 3: Check Vercel Environment Variables

Ensure these environment variables are set in Vercel:

1. Go to Project Settings → Environment Variables
2. Verify `DATABASE_URL` is set correctly
3. Verify `DIRECT_URL` is set correctly (if using Prisma Accelerate)
4. Make sure all required environment variables from your local `.env` are present

### Solution 4: Verify Build Command

In Vercel Project Settings → General:

- **Build Command:** `yarn build` (or leave default)
- **Output Directory:** `.next` (or leave default)
- **Install Command:** `yarn install` (or leave default)

### Solution 5: Check Prisma Configuration

Ensure your `prisma/schema.prisma` has the correct generator:

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
```

## Files Modified

1. **`.vercelignore`** - Created to exclude cache files
2. **`next.config.ts`** - Added `output: 'standalone'` for better Vercel compatibility

## Next Steps

1. Commit these changes:
   ```bash
   git add .vercelignore next.config.ts VERCEL_BUILD_FIX.md
   git commit -m "fix: resolve vercel build cache issue"
   git push
   ```

2. Follow Solution 1 above to clear Vercel's build cache

3. Monitor the deployment logs in Vercel dashboard

## If Issue Persists

Check the Vercel deployment logs for:
- Database connection errors
- Missing environment variables
- Prisma generation errors

The error should be resolved after clearing the cache and redeploying.
