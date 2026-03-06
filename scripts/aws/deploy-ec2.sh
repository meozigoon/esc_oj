#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.aws}"
COMPOSE_FILE="${2:-docker-compose.aws.yml}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
fi

echo "[1/4] Build judge image"
docker build -t oj-runner:latest ./judge

echo "[2/4] Build server/worker images"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build server worker

echo "[3/4] Start services"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

echo "[4/4] Apply DB migrations"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm server npx prisma migrate deploy --schema=prisma/schema.prisma

echo "Deployment completed."
echo "Run seed on first deployment if needed:"
echo "docker compose --env-file $ENV_FILE -f $COMPOSE_FILE run --rm server node prisma/seed.js"
