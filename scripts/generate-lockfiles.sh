#!/bin/bash
set -e

echo "🔐 Generating missing package-lock.json files..."
echo ""

# Root
echo "📦 Root: Generating lockfile..."
cd "$(dirname "$0")/.."
npm install --package-lock-only
echo "✅ Root lockfile generated"
echo ""

# Frontend
echo "📦 Frontend: Generating lockfile..."
cd "$(dirname "$0")/../frontend"
npm install --package-lock-only
echo "✅ Frontend lockfile generated"
echo ""

echo "🎉 All lockfiles have been generated!"
echo "Commit these files to ensure consistent dependencies across environments."
