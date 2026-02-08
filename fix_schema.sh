#!/bin/bash

# Fix id fields - add @default(cuid())
sed -i '' 's/id\s\+String\s\+@id$/id  String  @id @default(cuid())/g' prisma/schema.prisma

# Fix updatedAt fields - add @updatedAt
sed -i '' 's/updatedAt\s\+DateTime$/updatedAt  DateTime  @updatedAt/g' prisma/schema.prisma

echo "Schema fixed!"
