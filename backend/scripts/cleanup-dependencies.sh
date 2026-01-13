#!/bin/bash
# Dependency Cleanup Script
# This script implements the low-risk recommendations from the dependency audit

set -e  # Exit on error

echo "🔍 Starting dependency cleanup..."
echo ""

# Step 1: Remove unused Sentry packages
echo "📦 Step 1: Removing unused Sentry packages..."
if grep -q "@sentry/node" package.json; then
    npm uninstall @sentry/node @sentry/profiling-node
    echo "✅ Removed Sentry packages"
else
    echo "ℹ️  Sentry packages already removed"
fi
echo ""

# Step 2: Update safe dependencies
echo "⬆️  Step 2: Updating safe dependencies..."
npm update dotenv
echo "✅ Updated dotenv"
echo ""

# Step 3: Run tests to ensure nothing broke
echo "🧪 Step 3: Running tests..."
if npm test; then
    echo "✅ All tests passed"
else
    echo "❌ Tests failed - review changes"
    exit 1
fi
echo ""

# Step 4: Run security audit
echo "🔒 Step 4: Running security audit..."
npm audit
echo ""

# Summary
echo "✨ Dependency cleanup complete!"
echo ""
echo "📋 Next manual steps:"
echo "1. Move @types/nodemailer and @types/redis to devDependencies in package.json"
echo "2. Remove non-existent directory references from scripts"
echo "3. Review DEPENDENCY_AUDIT_REPORT.md for medium/high risk updates"
echo ""
