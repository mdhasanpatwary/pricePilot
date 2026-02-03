#!/bin/bash

# Fix async params in all route files

files=(
  "app/api/v1/monitoring/channels/[id]/test/route.ts"
  "app/api/v1/monitoring/maintenance-window/[id]/route.ts"
  "app/api/v1/auto-approval-rules/[id]/route.ts"
  "app/api/v1/auto-approval-rules/[id]/toggle/route.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # This is a placeholder - we'll fix each file individually
  fi
done

echo "Done!"
