#!/usr/bin/env python3
import os
import re

# Files to fix and their replacements
files_to_fix = [
    ('lib/services/sync-orchestrator.ts', [
        (r'where:\s*{\s*userProduct:\s*{', 'where: { Product_ProductMatch_userProductIdToProduct: {'),
        (r'include:\s*{\s*userProduct:', 'include: { Product_ProductMatch_userProductIdToProduct:'),
        (r'm\.userProduct\.', 'm.Product_ProductMatch_userProductIdToProduct.'),
    ]),
    ('lib/services/matching.ts', [
        (r'where:\s*{\s*userProduct:\s*{', 'where: { Product_ProductMatch_userProductIdToProduct: {'),
        (r'include:\s*{\s*userProduct:', 'include: { Product_ProductMatch_userProductIdToProduct:'),
        (r'm\.userProduct\.', 'm.Product_ProductMatch_userProductIdToProduct.'),
    ]),
    ('lib/services/cache-warming.ts', [
        (r'userProduct:\s*{', 'Product_ProductMatch_userProductIdToProduct: {'),
        (r'm\.userProduct\.', 'm.Product_ProductMatch_userProductIdToProduct.'),
    ]),
    ('app/api/v1/analytics/summary/route.ts', [
        (r'where:\s*{\s*userProduct:\s*{', 'where: { Product_ProductMatch_userProductIdToProduct: {'),
    ]),
    ('app/api/v1/analytics/price-elasticity/route.ts', [
        (r'where:\s*{\s*userProduct:\s*{', 'where: { Product_ProductMatch_userProductIdToProduct: {'),
        (r'include:\s*{\s*userProduct:', 'include: { Product_ProductMatch_userProductIdToProduct:'),
    ]),
    ('app/api/v1/analytics/tech-intelligence/route.ts', [
        (r'where:\s*{\s*userProduct:\s*{', 'where: { Product_ProductMatch_userProductIdToProduct: {'),
    ]),
    ('app/api/v1/matching/route.ts', [
        (r'\{\s*userProduct:\s*{', '{ Product_ProductMatch_userProductIdToProduct: {'),
        (r'userProduct:\s*{', 'Product_ProductMatch_userProductIdToProduct: {'),
        (r'userProduct:', 'Product_ProductMatch_userProductIdToProduct:'),
        (r'm\.userProduct\.', 'm.Product_ProductMatch_userProductIdToProduct.'),
    ]),
]

for filepath, replacements in files_to_fix:
    fullpath = os.path.join('/Applications/MAMP/htdocs/PricePilot', filepath)
    if os.path.exists(fullpath):
        with open(fullpath, 'r') as f:
            content = f.read()

        original_content = content
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)

        if content != original_content:
            with open(fullpath, 'w') as f:
                f.write(content)
            print(f"Fixed: {filepath}")
        else:
            print(f"No changes needed: {filepath}")
    else:
        print(f"File not found: {filepath}")

print("\nDone!")
