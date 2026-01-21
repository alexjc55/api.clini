#!/bin/bash
set -e

cd /www/api.clini.co.il/

echo "=== 1. Pulling latest code ==="
git pull origin main

echo "=== 2. Installing dependencies ==="
npm install

echo "=== 3. Building TypeScript ==="
npm run build

echo "=== 4. Running database migrations ==="
NODE_ENV=production MIGRATE_CONFIRM=1 npx tsx scripts/migrate.ts

echo "=== 5. Restarting application ==="
pm2 restart api.clini --update-env || pm2 start npm --name "api.clini" -- start

echo "=== 6. Checking health ==="
sleep 3
curl -s http://localhost:5000/api/v1/health | head -c 200

echo ""
echo "=== Deployment complete ==="
