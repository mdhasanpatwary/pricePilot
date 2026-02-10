#!/bin/bash

# Script to migrate all admin endpoints to use request-scoped caching
# This script updates imports and function calls in all admin route files

echo "🚀 Starting admin endpoints migration..."

# Find all admin route files that still use getServerSession
FILES=$(grep -l "getServerSession" app/api/v1/admin/**/*.ts 2>/dev/null)

if [ -z "$FILES" ]; then
    echo "✅ No files to migrate!"
    exit 0
fi

COUNT=0
for FILE in $FILES; do
    echo "📝 Migrating: $FILE"
    
    # Backup original file
    cp "$FILE" "$FILE.bak"
    
    # Step 1: Update imports - Remove old imports
    sed -i '' 's/import { getServerSession } from "next-auth";//' "$FILE"
    sed -i '' 's/import { getServerSession } from "next-auth\/next";//' "$FILE"
    sed -i '' 's/import { authOptions } from "@\/lib\/auth";//' "$FILE"
    sed -i '' 's/import { withRateLimit } from "@\/lib\/middleware\/ratelimit";//' "$FILE"
    
    # Step 2: Add new imports at the top (after existing imports)
    # Check if getCachedSession is already imported
    if ! grep -q "getCachedSession" "$FILE"; then
        # Find the last import line and add new imports after it
        sed -i '' '/^import.*from/a\
import { getCachedSession } from "@/lib/auth/cached-session";\
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
' "$FILE"
    fi
    
    # Step 3: Replace getServerSession calls with getCachedSession
    sed -i '' 's/await getServerSession(authOptions)/await getCachedSession()/g' "$FILE"
    sed -i '' 's/getServerSession(authOptions)/getCachedSession()/g' "$FILE"
    
    # Step 4: Replace withRateLimit with withRequestContextAndRateLimit
    sed -i '' 's/withRateLimit(/withRequestContextAndRateLimit(/g' "$FILE"
    
    # Clean up empty lines
    sed -i '' '/^$/N;/^\n$/D' "$FILE"
    
    COUNT=$((COUNT + 1))
done

echo "✅ Migration complete! Migrated $COUNT files."
echo "📦 Backup files created with .bak extension"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Run build: npm run build"
echo "3. Test endpoints"
echo "4. Remove backups: find app/api/v1/admin -name '*.bak' -delete"
