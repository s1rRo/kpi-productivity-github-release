#!/bin/bash

# Documentation Deployment Script
# This script builds and deploys the interactive documentation interface

set -e

echo "🚀 Starting documentation deployment..."

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the docs/interactive directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the application
echo "🔨 Building documentation interface..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed. dist directory not found."
    exit 1
fi

echo "✅ Build completed successfully!"

# Optional: Deploy to static hosting
if [ "$1" = "--deploy" ]; then
    echo "🌐 Deploying to static hosting..."
    
    # Example deployment commands (uncomment and modify as needed)
    # For Vercel:
    # npx vercel --prod
    
    # For Netlify:
    # npx netlify deploy --prod --dir=dist
    
    # For GitHub Pages:
    # gh-pages -d dist
    
    # For now, just copy to a deployment directory
    DEPLOY_DIR="../deployment"
    mkdir -p "$DEPLOY_DIR"
    cp -r dist/* "$DEPLOY_DIR/"
    echo "✅ Documentation deployed to $DEPLOY_DIR"
else
    echo "💡 To deploy, run: ./scripts/deploy.sh --deploy"
fi

echo "🎉 Documentation deployment completed!"
echo "📖 You can now serve the documentation from the dist/ directory"