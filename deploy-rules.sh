#!/bin/bash

# Firebase Rules Deployment Script
# This will deploy the updated Realtime Database rules to fix cursor/presence issues

set -e  # Exit on error

echo "🔥 Deploying Firebase Realtime Database Rules..."
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install it with:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Login check
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Authentication required. Running firebase login..."
    firebase login
fi

# Select project
echo "📋 Selecting Firebase project: collabboard-fe299"
firebase use collabboard-fe299

# Deploy only database rules
echo "🚀 Deploying database rules..."
firebase deploy --only database

echo ""
echo "✅ Database rules deployed successfully!"
echo ""
echo "🧪 Next steps:"
echo "  1. Refresh both test browsers"
echo "  2. Log in as different users"
echo "  3. Navigate to the same board"
echo "  4. Move your mouse in one browser"
echo "  5. Watch for cursors to appear in the other browser!"
echo ""
echo "📊 Check browser console for these logs:"
echo "  👥 usePresence: Received presence update..."
echo "  👁️ useCursors: Received cursor update..."
echo ""
