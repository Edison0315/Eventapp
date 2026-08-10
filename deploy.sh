#!/bin/bash
set -euo pipefail

source /opt/app/.env

ECR_REGISTRY="${ECR_REGISTRY:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AWS_REGION="eu-north-1"

if [ -z "$ECR_REGISTRY" ]; then
  echo "ERROR: ECR_REGISTRY no está definido"
  exit 1
fi

cd /opt/app

echo "[deploy] Pulling latest code..."

sudo -u ubuntu git pull origin main || { echo "git pull failed"; exit 1; }

echo "[deploy] Logging into ECR..."

aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "[deploy] Pulling images (timeout: 10min)..."
timeout 600 docker compose pull || { echo "docker compose pull failed"; exit 1; }

echo "[deploy] Starting containers..."
docker compose up -d --remove-orphans
echo "[deploy] Waiting for containers to be healthy..."
sleep 10

echo "[deploy] Container status:"
docker compose ps
echo "[deploy] Pruning old images..."
docker image prune -f
echo "[deploy] Done!"