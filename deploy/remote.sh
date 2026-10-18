#!/bin/bash

set -eu

if [ -f /opt/agentyard/docker-compose.prod.yml ]; then
  docker compose -f /opt/agentyard/docker-compose.prod.yml --project-directory /opt/agentyard down
fi

if [ -f /opt/agentyard/docker-compose.yml ]; then
  docker compose -f /opt/agentyard/docker-compose.yml --project-directory /opt/agentyard down
fi

cd "$DEPLOY_PATH"

if [ ! -f .env ]; then
  secret=$(openssl rand -base64 48 | tr -d '\n')
  umask 077
  cat > .env <<ENV
SECRET_KEY_BASE=${secret}
PHX_HOST=agentyard.letz.tw
PORT=4000
PHX_SERVER=true
DOMAIN=agentyard.letz.tw
ENV
  chmod 600 .env
fi

printf '%s' "$GITHUB_TOKEN" | docker login ghcr.io --username "$GHCR_USERNAME" --password-stdin
export LAST_KEEP_IMAGE_TAG="$IMAGE_TAG"
docker compose -f docker-compose.prod.yml pull
# The app is replaced first. Caddy is recreated only after that container is
# healthy. One `up` leaves the previous proxy Running, and `--wait` then calls
# it healthy because it had no check. The smoke was hitting a proxy that lost
# its upstream while the browser installed.
docker compose -f docker-compose.prod.yml up -d --wait --remove-orphans --no-deps app
docker compose -f docker-compose.prod.yml up -d --wait --force-recreate --no-deps caddy
docker logout ghcr.io || true
docker image prune -f
