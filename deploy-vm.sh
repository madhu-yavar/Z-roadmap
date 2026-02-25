#!/bin/bash
set -e

echo "🚀 Deploying Roadmap Agent to VM (z-roadmap.yavar.ai)..."

SSH_KEY="~/Downloads/yavar-poc"
VM_USER="yavar-poc"
VM_HOST="35.244.7.120"
VM_PATH="~/poc/Z-roadmap"

# Pull latest changes on VM
echo "📥 Pulling latest changes on VM..."
ssh -i "$SSH_KEY" "${VM_USER}@${VM_HOST}" "cd $VM_PATH && git pull"

# Build and start containers (this will rebuild if needed)
echo "🔨 Building and starting containers on VM..."
ssh -i "$SSH_KEY" "${VM_USER}@${VM_HOST}" "cd $VM_PATH && sudo docker compose -f docker-compose.prod.yml up -d --build"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 15

# Check backend health
echo "🔍 Checking backend health..."
if curl -f https://z-roadmap.yavar.ai/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
else
    echo "❌ Backend health check failed!"
    ssh -i "$SSH_KEY" "${VM_USER}@${VM_HOST}" "cd $VM_PATH && sudo docker compose -f docker-compose.prod.yml logs backend --tail 50"
    exit 1
fi

# Show running containers
echo "📦 Running containers on VM:"
ssh -i "$SSH_KEY" "${VM_USER}@${VM_HOST}" "cd $VM_PATH && sudo docker compose -f docker-compose.prod.yml ps"

echo "✅ Deployment to VM complete!"
echo "🌐 Access your application at: https://z-roadmap.yavar.ai/"
