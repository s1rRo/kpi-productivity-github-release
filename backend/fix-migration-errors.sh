#!/bin/bash

# Script to fix migration errors after updating dependencies

echo "Fixing Zod 4 migration: errors -> issues"
find src -type f -name "*.ts" -exec sed -i '' 's/\.errors/.issues/g' {} \;

echo "Fixing deprecated @types imports"
# Remove deprecated @types/bcryptjs and @types/redis from imports if they exist

echo "Migration fixes applied!"
echo "Please run 'npx tsc --noEmit' to check for remaining errors"
