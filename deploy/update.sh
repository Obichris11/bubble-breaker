#!/usr/bin/env bash
# Redeploys Bubble Breaker when the configured image changed (06-deployment "Updater").
# DSM Task Scheduler runs it as root once a month (Task Scheduler → Run deploys now):
#   bash /volume1/docker/bubble-breaker/update.sh
# Silent when nothing changed; exits 1 (DSM marks the run failed) when a deploy fails.
set -euo pipefail

cd "$(dirname "$0")"
# DSM tasks run with a minimal PATH; docker lives in /usr/local/bin there.
export PATH="${PATH}:/usr/local/bin:/usr/bin:/bin"

CONTAINER=bubble-breaker
SOURCE_LABEL=org.opencontainers.image.source=https://github.com/Obichris11/bubble-breaker
# Docker < 25 ignores --start-interval: the first check is at 30 s, a retry at 60 s.
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-90}
POLL_SECONDS=${POLL_SECONDS:-2}
LOG=update.log

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

is_running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)" = true ]
}

prune() {
  # Only dangling images of this repo: a pinned rollback tag stays.
  docker image prune -f --filter "label=${SOURCE_LABEL}" >/dev/null
}

# A failed deploy: log it, show why and the container's last lines, exit 1 so DSM marks the run failed.
fail() {
  log "FAILED ${from} -> ${to}: $1"
  echo "bubble-breaker ${from} -> ${to} failed: $1" >&2
  docker logs --tail 50 "$CONTAINER" >&2 || true
  exit 1
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
  version=$(version_of "$running")
  # Keep failing on every run while the deployed container is stopped or unhealthy.
  if ! is_running; then
    echo "bubble-breaker ${version} is not running" >&2
    exit 1
  fi
  case "$(health)" in
    unhealthy)
      echo "bubble-breaker ${version} is unhealthy" >&2
      docker logs --tail 50 "$CONTAINER" >&2 || true
      exit 1
      ;;
    healthy)
      # A deploy logged FAILED that turned healthy later: record it and prune what it kept.
      if tail -n 1 "$LOG" 2>/dev/null | grep -q ' FAILED '; then
        prune
        log "recovered ${version}"
      fi
      ;;
  esac
  exit 0
fi

from=none
if [ -n "$running" ]; then
  from=$(version_of "$running")
fi
to=$(version_of "$wanted")

if ! compose up -d --remove-orphans; then
  fail 'compose up failed'
fi
waited=0
until [ "$(health)" = healthy ]; do
  if [ "$waited" -ge "$HEALTH_TIMEOUT" ]; then
    fail "not healthy after ${HEALTH_TIMEOUT}s"
  fi
  sleep "$POLL_SECONDS"
  waited=$((waited + POLL_SECONDS))
done

prune
log "${from} -> ${to}"
