#!/bin/bash
set -e

echo "📈 Updating minor versions (safe updates)..."
echo ""

# Backend
echo "📦 Backend: Updating helmet and dotenv..."
cd "$(dirname "$0")/../backend"
npm update helmet dotenv
echo "✅ Backend minor updates complete"
echo ""

# Gateway
echo "📦 Gateway: Updating dotenv..."
cd "$(dirname "$0")/../gateway"
npm update dotenv
echo "✅ Gateway minor updates complete"
echo ""

# Frontend
echo "📦 Frontend: Updating lucide-react..."
cd "$(dirname "$0")/../frontend"
npm update lucide-react
echo "✅ Frontend minor updates complete"
echo ""

# Docs
echo "📦 Docs: Updating lucide-react..."
cd "$(dirname "$0")/../docs/interactive"
npm update lucide-react
echo "✅ Docs minor updates complete"
echo ""

echo "🎉 All minor updates have been applied!"
echo "Run tests to verify everything works correctly."
