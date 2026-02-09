PricePilot OpenCart Integration File
=====================================

File: pricepilot-simple.php
Version: 1.0.0
Size: ~5 KB

INSTALLATION INSTRUCTIONS
=========================

Step 1: Upload File
-------------------
Upload this file to your OpenCart installation:
Location: /api/pricepilot.php

Via FTP:
1. Connect to your server
2. Navigate to OpenCart root directory
3. Go to 'api' folder (create if doesn't exist)
4. Upload 'pricepilot-simple.php'
5. Rename to 'pricepilot.php'

Via cPanel:
1. Login to cPanel → File Manager
2. Navigate to OpenCart root → api folder
3. Upload 'pricepilot-simple.php'
4. Rename to 'pricepilot.php'

Step 2: Enable API in OpenCart
-------------------------------
1. OpenCart Admin → System → Users → API
2. Click 'Add New'
3. Username: pricepilot
4. Status: Enabled
5. Click 'Generate' to create API Key
6. COPY the API Key
7. Click 'Save'
8. Go to 'IP Addresses' tab
9. Add IP: 0.0.0.0 (or your PricePilot server IP)
10. Save

Step 3: Connect to PricePilot
------------------------------
1. Go to PricePilot Dashboard
2. Click 'Add Site' or 'Integrations'
3. Select 'OpenCart'
4. Enter your store URL
5. Paste the API Key
6. Click 'Save'
7. Click 'Sync Now'

DONE! Your products will sync automatically.

FEATURES
========
✓ Product images
✓ Brand/Manufacturer names
✓ Model numbers
✓ SKU codes
✓ Current prices
✓ Stock quantities

SUPPORT
=======
Need help? Contact PricePilot support from your dashboard.

Total Setup Time: 3 minutes
Technical Skill: Basic (upload 1 file)
