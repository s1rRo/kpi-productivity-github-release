#!/bin/bash
set -e

echo "🔒 Fixing security vulnerabilities across all packages..."
echo ""

# Backend
echo "📦 Backend: Updating vitest and coverage packages..."
cd "$(dirname "$0")/../backend"
npm install vitest@^4.0.17 @vitest/coverage-v8@^4.0.17 --save-dev
echo "✅ Backend security fixes applied"
echo ""

# Gateway
echo "📦 Gateway: Updating vitest..."
cd "$(dirname "$0")/../gateway"
npm install vitest@^4.0.17 --save-dev
echo "✅ Gateway security fixes applied"
echo ""

# Docs
echo "📦 Docs: Updating vite and react-syntax-highlighter..."
cd "$(dirname "$0")/../docs/interactive"
npm install vite@^7.3.1 react-syntax-highlighter@^16.1.0
echo "✅ Docs security fixes applied"
echo ""

echo "🎉 All security vulnerabilities have been fixed!"
echo "Run 'npm audit' in each directory to verify."
