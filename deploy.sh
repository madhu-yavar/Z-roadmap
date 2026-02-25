#!/bin/bash
set -e

echo "🚀 Deploying Roadmap Agent with Full Stack (FS) feature..."

# Pull latest changes
echo "📥 Pulling latest changes from git..."
git pull origin main

# Stop existing containers
echo "⏹️  Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

# Build and start new containers
echo "🔨 Building new Docker images..."
docker compose -f docker-compose.prod.yml build --no-cache

echo "🚀 Starting containers..."
docker compose -f docker-compose.prod.yml up -d

# Wait for backend to be healthy
echo "⏳ Waiting for backend to start..."
sleep 10

# Check backend health (through nginx proxy)
echo "🔍 Checking backend health..."
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
else
    echo "❌ Backend health check failed!"
    docker compose -f docker-compose.prod.yml logs backend
    exit 1
fi

# Show running containers
echo "📦 Running containers:"
docker compose -f docker-compose.prod.yml ps

echo "✅ Deployment complete!"
echo "🌐 Access your application at: https://z-roadmap.yavar.ai/"
