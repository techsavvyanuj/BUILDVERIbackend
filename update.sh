#!/bin/bash

# Quick update script for BuildVeritas Backend
# Run this script to update your application after making changes

set -e

APP_DIR="/var/www/buildveritas-backend"
BACKUP_DIR="/var/backups/buildveritas-$(date +%Y%m%d_%H%M%S)"

echo "🔄 Updating BuildVeritas Backend..."

# Create backup
echo "💾 Creating backup..."
sudo mkdir -p /var/backups
sudo cp -r $APP_DIR $BACKUP_DIR

# Navigate to app directory
cd $APP_DIR

# Stop application
echo "⏹️ Stopping application..."
pm2 stop buildveritas-backend

# Pull latest changes
echo "📥 Pulling latest changes from Git..."
git pull origin main

# Install/update dependencies
echo "📦 Updating dependencies..."
npm ci --production

# Restart application
echo "🚀 Restarting application..."
pm2 start buildveritas-backend

# Save PM2 configuration
pm2 save

echo "✅ Update completed successfully!"
echo "📊 Application status:"
pm2 status buildveritas-backend