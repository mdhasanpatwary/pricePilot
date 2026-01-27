# Troubleshooting: No Products Found

## Issue
The products page shows "No products found" even after seeding the database.

## Possible Causes

### 1. **Not Logged In with the Correct User**
The seeded data is for:
- Email: `test@example.com`
- Password: `password123`
- Tenant ID: `test-tenant-id`

**Action**: Make sure you're logged in with this exact email.

### 2. **Logged In with Different Tenant**
If you created another user or are using a different account, you won't see the seeded products because they belong to the `test-tenant-id` tenant.

**Action**: Either:
- Log out and log in with `test@example.com`
- OR run the seed script again to add products to your current tenant

### 3. **Session Issue**
Your session might be pointing to a different tenant.

**Action**: 
1. Open browser DevTools (F12)
2. Go to Application > Cookies
3. Clear all cookies for localhost
4. Log in again with `test@example.com` / `password123`

### 4. **Database Connection Issue**
The app might not be connecting to the database properly.

**Action**: Check the browser console (F12) for any API errors when loading the products page.

## Quick Fix

Run this command to check what's in your database:
```bash
npx prisma studio
```

This will open a visual database browser at http://localhost:5555 where you can:
1. Check if products exist in the Product table
2. Check if they have the correct tenantId
3. Check if the Site type is "USER"

## If Products Exist But Still Not Showing

The API filters products by:
1. Your tenant ID (from session)
2. Site type = "USER"

Check in Prisma Studio:
- Do the products have `tenantId = "test-tenant-id"`?
- Do the products have a `siteId` that points to a Site with `type = "USER"`?
