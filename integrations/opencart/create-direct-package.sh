#!/bin/bash

# Create a direct upload package (not .ocmod)
# This package can be extracted directly to OpenCart root

echo "📦 Creating Direct Upload Package..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/pricepilot-direct-upload.zip"

# Clean previous build
rm -f "$OUTPUT_FILE"

echo "📁 Packaging files..."

# Create zip with the actual file structure
cd "$SCRIPT_DIR"
zip -r "$OUTPUT_FILE" \
    admin/controller/extension/module/pricepilot.php \
    admin/language/en-gb/extension/module/pricepilot.php \
    admin/view/template/extension/module/pricepilot.twig \
    catalog/controller/api/pricepilot.php

echo ""
echo "✅ Package created: pricepilot-direct-upload.zip"
echo ""
echo "📋 Installation Instructions:"
echo ""
echo "METHOD 1: Extract to OpenCart Root (Recommended)"
echo "1. Download pricepilot-direct-upload.zip"
echo "2. Extract it to your OpenCart root directory"
echo "3. It will create/overwrite these files:"
echo "   - admin/controller/extension/module/pricepilot.php"
echo "   - admin/language/en-gb/extension/module/pricepilot.php"
echo "   - admin/view/template/extension/module/pricepilot.twig"
echo "   - catalog/controller/api/pricepilot.php"
echo "4. Clear cache (delete files in system/storage/cache/)"
echo "5. Refresh browser and check PricePilot page"
echo ""
echo "METHOD 2: Upload via FTP"
echo "1. Extract pricepilot-direct-upload.zip on your computer"
echo "2. Upload the extracted folders to OpenCart root via FTP"
echo "3. Overwrite existing files when prompted"
echo "4. Clear cache and refresh"
echo ""
