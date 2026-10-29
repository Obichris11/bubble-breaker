#!/usr/bin/env bash
# Redeploys Bubble Breaker when the configured image changed (06-deployment "Updater").
# DSM Task Scheduler runs it as root every 15 minutes:
#   bash /volume1/docker/bubble-breaker/update.sh
# Silent when nothing changed; exits 1 (so DSM sends an email) when a deploy fails.
set -euo pipefail

cd "$(dirname "$0")"
# DSM tasks run with a minimal PATH; docker lives in /usr/local/bin there.
export PATH="${PATH}:/usr/local/bin:/usr/bin:/bin"

CONTAINER=bubble-breaker
SOURCE_LABEL=org.opencontainers.image.source=https://github.com/Obichris11/bubble-breaker
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}
POLL_SECONDS=${POLL_SECONDS:-2}
LOG=update.log

# One run at a time: a slow pull must not overlap the next scheduled run.
exec 9>.update.lock
flock -n 9 || exit 0

if docker compose version >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
else
  compose() { docker-compose "$@"; }
fi

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$LOG"
  tail -n 500 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
}

version_of() {
  local version
  version=$(docker image inspect \
    -f '{{index .Config.Labels "org.opencontainers.image.version"}}' "$1" 2>/dev/null || true)
  echo "${version:-unknown}"
}

health() {
  docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || true
}

image=$(compose config --images | head -n 1)
# `pull -q` still reports progress on stderr; show it only when the pull fails.
if ! pulled=$(compose pull -q 2>&1); then
  echo "$pulled" >&2
  exit 1
fi
wanted=$(docker image inspect -f '{{.Id}}' "$image")
running=$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null || true)
if [ "$wanted" = "$running" ]; then
  # Keep failing (one email per run) while a deployed container is unhealthy.
  if [ "$(health)" = unhealthy ]; then
    echo "bubble-breaker $(version_of "$running") is unhealthy" >&2
    docker logs --tail 50 "$CONTAINER" >&2 || true
    exit 1
  fi
  exit 0
fi

from=none
if [ -n "$running" ]; then
  from=$(version_of "$running")
fi
to=$(version_of "$wanted")

compose up -d --remove-orphans
waited=0
until [ "$(health)" = healthy ]; do
  if [ "$waited" -ge "$HEALTH_TIMEOUT" ]; then
    log "FAILED ${from} -> ${to}: not healthy after ${HEALTH_TIMEOUT}s"
    echo "bubble-breaker ${to} did not become healthy within ${HEALTH_TIMEOUT}s" >&2
    docker logs --tail 50 "$CONTAINER" >&2 || true
    exit 1
  fi
  sleep "$POLL_SECONDS"
  waited=$((waited + POLL_SECONDS))
done

# Only dangling images of this repo: a pinned rollback tag stays.
docker image prune -f --filter "label=${SOURCE_LABEL}" >/dev/null
log "${from} -> ${to}"
