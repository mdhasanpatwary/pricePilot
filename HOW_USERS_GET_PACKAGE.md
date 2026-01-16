# 📦 How Users Get the PricePilot Laravel Package

## Summary

Your tenants (users) can get the Laravel package in **3 simple ways**:

---

## ✅ Option 1: Download from Dashboard (RECOMMENDED)

### What You Need to Build

Create a download page in your PricePilot dashboard:

**URL**: `/dashboard/integrations/laravel/download`

**Page Content**:
```
┌─────────────────────────────────────────────────┐
│  📦 PricePilot Laravel Integration              │
│  Version 1.0.0                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Download Package v1.0.0]                      │
│                                                 │
│  Quick Installation:                            │
│  1. Download the package above                  │
│  2. Extract to your Laravel project             │
│  3. Run: php artisan pricepilot:install         │
│  4. Copy the generated token                    │
│  5. Click "Connect Store" below                 │
│                                                 │
│  [Connect Store]  [View Full Documentation]     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Implementation Steps

1. **Create the zip file**:
```bash
cd /Applications/MAMP/htdocs/PricePilot/integrations
zip -r pricepilot-laravel-v1.0.0.zip laravel/ -x "*/vendor/*" "*/node_modules/*"
```

2. **Host the file**:
   - Upload to `/public/downloads/pricepilot-laravel-v1.0.0.zip`
   - Or use a CDN/cloud storage

3. **Create download endpoint**:
```typescript
// app/api/downloads/laravel/route.ts
export async function GET() {
  const filePath = path.join(process.cwd(), 'public/downloads/pricepilot-laravel-v1.0.0.zip');
  const file = await fs.readFile(filePath);

  return new Response(file, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="pricepilot-laravel-v1.0.0.zip"',
    },
  });
}
```

### User Experience

1. User logs into PricePilot
2. Goes to Dashboard → Integrations
3. Clicks on "Laravel"
4. Sees download button
5. Downloads zip file
6. Follows installation instructions

---

## ✅ Option 2: Via Composer (GitHub)

### Setup (One-time)

1. **Create GitHub repository**:
```bash
cd /Applications/MAMP/htdocs/PricePilot/integrations/laravel
git init
git add .
git commit -m "Initial release v1.0.0"
git tag v1.0.0
git remote add origin https://github.com/pricepilot/laravel-client.git
git push -u origin main
git push --tags
```

2. **Make it public or private** (your choice)

### User Installation

Users add to their `composer.json`:

```json
{
    "repositories": [
        {
            "type": "vcs",
            "url": "https://github.com/pricepilot/laravel-client.git"
        }
    ],
    "require": {
        "pricepilot/laravel-client": "^1.0"
    }
}
```

Then run:
```bash
composer install
php artisan pricepilot:install
```

---

## ✅ Option 3: Via Packagist (Future)

### When Ready

1. Create account at [packagist.org](https://packagist.org)
2. Submit package
3. Users install with:

```bash
composer require pricepilot/laravel-client
php artisan pricepilot:install
```

---

## 🎯 Recommended Approach

**For Now**: Use **Option 1 (Dashboard Download)**

**Why?**
- ✅ Easiest for users (no Git/Composer knowledge needed)
- ✅ You control distribution
- ✅ Can track downloads
- ✅ Can update anytime
- ✅ Works for all users

**Later**: Migrate to **Option 2 (GitHub + Composer)**

**Why?**
- ✅ Professional distribution
- ✅ Easy version management
- ✅ Automatic updates via Composer
- ✅ Industry standard

---

## 📋 Complete User Journey

### Step 1: User Gets Package

```
User → PricePilot Dashboard → Integrations → Laravel → Download
```

### Step 2: User Installs

```bash
# Extract downloaded zip
unzip pricepilot-laravel-v1.0.0.zip -d packages/pricepilot/

# Install
php artisan pricepilot:install
```

Output:
```
Installing PricePilot Laravel Integration...

✓ Configuration published to config/pricepilot.php
✓ Generated secure API token
  Token: abc123def456...xyz789

⚠ IMPORTANT: Copy this token to your PricePilot dashboard!
  You can find it in your .env file as PRICEPILOT_API_TOKEN

Next steps:
1. Copy your PRICEPILOT_API_TOKEN from .env
2. Go to PricePilot Dashboard → Integrations
3. Select Laravel and enter your store URL
4. Paste the API token and click "Verify & Connect"

Installation complete! 🚀
```

### Step 3: User Connects

```
User → PricePilot Dashboard → Integration Page (e.g., OpenCart/Laravel) → Click "Go back and Connect Store"
User → Connections Page → Click "Connect Store"
  Platform: Laravel / OpenCart
  Store URL: https://mystore.com
  API Token: abc123def456...xyz789
  → Click "Verify & Connect"
```

### Step 4: Navigation Flow

We have implemented a seamless flow for users:
1. **Connections Page**: User selects platform.
2. **Integration Page**: User downloads package, following steps 1-4.
3. **Step 5 / Bottom CTA**: A clear "Go back and Connect Store" button leads them back to the connections flow.
4. **Header Link**: A "&larr; Back to Connections" link is provided in the header for easy return.

### Step 4: Connection Verified

```
PricePilot → Laravel Store: GET /api/pricepilot/health
Laravel → PricePilot: { "status": "ok", "products_count": 150 }
✓ Connection Successful!
```

---

## 🔧 What You Need to Build

### 1. Download Page (Priority: HIGH)

**File**: `app/dashboard/integrations/laravel/page.tsx`

**Features**:
- Download button for latest version
- Installation instructions
- Link to full documentation
- Video tutorial (optional)

### 2. Download API Endpoint (Priority: HIGH)

**File**: `app/api/downloads/laravel/route.ts`

**Features**:
- Serve zip file
- Track downloads (optional)
- Require authentication

### 3. Documentation Link (Priority: MEDIUM)

Update connections page to show "Laravel Integration Guide" link

### 4. Version Management (Priority: LOW)

Track versions in database:
```sql
CREATE TABLE package_versions (
  id UUID PRIMARY KEY,
  platform VARCHAR(50),
  version VARCHAR(20),
  download_url TEXT,
  release_date TIMESTAMP,
  changelog TEXT
);
```

---

## 📊 Files to Host

**Required**:
- `pricepilot-laravel-v1.0.0.zip` (the package)

**Optional**:
- `pricepilot-laravel-latest.zip` (symlink to latest)
- `INSTALLATION_GUIDE.pdf` (PDF version of docs)
- `video-tutorial.mp4` (installation video)

---

## 🎬 Next Steps

1. **Create the zip file**:
```bash
cd /Applications/MAMP/htdocs/PricePilot/integrations
zip -r pricepilot-laravel-v1.0.0.zip laravel/
```

2. **Create download page** in dashboard

3. **Test the flow**:
   - Download package
   - Install in test Laravel project
   - Verify connection works

4. **Update documentation** with download link

---

## ✨ User-Facing Documentation

Update `DOCUMENTATION.md` to say:

```markdown
### Getting the Package

**Download from Dashboard**:
1. Log in to PricePilot
2. Go to Dashboard → Integrations → Laravel
3. Click "Download Package"
4. Extract the zip file

**Install**:
```bash
php artisan pricepilot:install
```

That's it! The command will guide you through the rest.
```

---

**Bottom Line**: Users download a zip file from your dashboard, extract it, run one command, and they're done! 🚀
