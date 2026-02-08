-- Fix admin user login issues
-- Run this in your database to ensure admin can log in

-- 1. Set emailVerified to true for all users (or specific email)
UPDATE "User"
SET
    "emailVerified" = NOW()
WHERE
    "emailVerified" IS NULL;

-- 2. Ensure at least one user is a super admin
-- Replace 'your-email@example.com' with your actual email
UPDATE "User"
SET
    "isSuperAdmin" = true
WHERE
    email = 'admin@example.com'
    OR email LIKE '%@example.com';

-- 3. Check the results
SELECT email, name, "isSuperAdmin", "emailVerified" IS NOT NULL as "email_verified", "passwordHash" IS NOT NULL as "has_password"
FROM "User";