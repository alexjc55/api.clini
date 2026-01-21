#!/bin/bash

# Clini API - Deployment Script
# Usage: bash scripts/deploy.sh

cd /www/api.clini.co.il/ || { echo "ERROR: Directory not found"; exit 1; }

echo "=== 1. Pulling latest code ==="
if ! git pull origin main; then
    echo "ERROR: git pull failed"
    read -p "Press Enter to continue..."
    exit 1
fi

echo "=== 2. Installing dependencies ==="
if ! npm install; then
    echo "ERROR: npm install failed"
    read -p "Press Enter to continue..."
    exit 1
fi

echo "=== 3. Building TypeScript ==="
if ! npm run build; then
    echo "ERROR: npm run build failed"
    read -p "Press Enter to continue..."
    exit 1
fi

echo "=== 4. Running database migrations ==="
if ! NODE_ENV=production MIGRATE_CONFIRM=1 npx tsx scripts/migrate.ts; then
    echo "ERROR: Database migration failed"
    read -p "Press Enter to continue..."
    exit 1
fi

echo "=== 5. Restarting application ==="
pm2 restart api.clini --update-env 2>/dev/null || pm2 start npm --name "api.clini" -- start

echo "=== 6. Checking health ==="
sleep 3
curl -s http://localhost:5000/api/v1/health || echo "Health check failed (app may still be starting)"

echo ""
echo "=== Deployment complete ==="
read -p "Press Enter to close..."
