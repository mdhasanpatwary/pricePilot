#!/bin/bash

# PricePilot OpenCart Extension Installer Builder
# This script creates a .ocmod.zip file for easy installation

echo "🔨 Building PricePilot OpenCart Extension Installer..."

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
OUTPUT_FILE="$SCRIPT_DIR/pricepilot.ocmod.zip"

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf "$BUILD_DIR"
rm -f "$OUTPUT_FILE"

# Create build directory
mkdir -p "$BUILD_DIR/upload"

echo "📦 Copying files..."

# Copy the install.xml (renamed from pricepilot.ocmod.xml)
cp "$SCRIPT_DIR/pricepilot.ocmod.xml" "$BUILD_DIR/install.xml"

echo "✅ Files copied"

# Create the zip file
echo "📦 Creating .ocmod.zip package..."
cd "$BUILD_DIR"
zip -r "$OUTPUT_FILE" install.xml upload/

# Clean up
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

echo ""
echo "✅ Build complete!"
echo "📦 Package created: pricepilot.ocmod.zip"
echo ""
echo "📋 Installation Instructions:"
echo "1. Go to OpenCart Admin → Extensions → Installer"
echo "2. Click 'Upload' and select pricepilot.ocmod.zip"
echo "3. After upload, go to Extensions → Modifications"
echo "4. Click 'Refresh' (blue refresh icon)"
echo "5. Go to Extensions → Extensions → Choose 'Modules'"
echo "6. Find 'PricePilot' and click 'Install'"
echo "7. Click 'Edit' to configure and copy your API token"
echo "8. The PricePilot menu will appear in the left sidebar"
echo ""
echo "🎉 Done!"
