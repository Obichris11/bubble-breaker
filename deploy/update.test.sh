#!/usr/bin/env bash
# Tests for deploy/update.sh against a stub `docker` (no daemon needed). CI's `docker` job runs:
#   bash deploy/update.test.sh
# Image ids in the stub are `sha256:<version>`, so the log line shows which version ran.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
failures=0
passed=0

# A fresh folder with a copy of update.sh, a stub docker and its state:
#   remote = id the registry has, local = id after the last pull,
#   running = id of the container's image (absent: no container),
#   health = what the health check reports, no-plugin = no `docker compose`.
setup() {
  WORK=$(mktemp -d)
  mkdir -p "$WORK/bin" "$WORK/state"
  cp "$HERE/update.sh" "$WORK/update.sh"
  cat >"$WORK/bin/docker" <<'STUB'
#!/usr/bin/env bash
S="$STUB_STATE"
echo "docker $*" >>"$S/calls"
case "$*" in
  'compose version') [ ! -f "$S/no-plugin" ] || exit 1 ;;
  'compose config --images') echo ghcr.io/obichris11/bubble-breaker:latest ;;
  'compose pull -q')
    echo ' Image ghcr.io/obichris11/bubble-breaker:latest Pulled' >&2
    [ ! -f "$S/offline" ] || { echo 'Error response from daemon: Get "https://ghcr.io/v2/": dial tcp: i/o timeout' >&2; exit 18; }
    cp "$S/remote" "$S/local" ;;
  'compose up -d --remove-orphans') cp "$S/local" "$S/running" ;;
  'image inspect -f {{.Id}} ghcr.io/obichris11/bubble-breaker:latest') cat "$S/local" ;;
  'inspect -f {{.Image}} bubble-breaker') cat "$S/running" 2>/dev/null || exit 1 ;;
  'inspect -f {{.State.Health.Status}} bubble-breaker') cat "$S/health" ;;
  'image inspect -f {{index .Config.Labels "org.opencontainers.image.version"}} sha256:'*)
    id=${!#}
    echo "${id#sha256:}" ;;
  'image prune -f --filter label=org.opencontainers.image.source=https://github.com/Obichris11/bubble-breaker') ;;
  'logs --tail 50 bubble-breaker') echo 'nginx: [emerg] example' ;;
  *) echo "unexpected: docker $*" >&2; exit 99 ;;
esac
STUB
  cat >"$WORK/bin/docker-compose" <<'STUB'
#!/usr/bin/env bash
echo "docker-compose $*" >>"$STUB_STATE/calls"
exec docker compose "$@"
STUB
  chmod +x "$WORK/bin/docker" "$WORK/bin/docker-compose"
  export STUB_STATE="$WORK/state"
  echo healthy >"$WORK/state/health"
}

run_update() {
  set +e
  PATH="$WORK/bin:$PATH" HEALTH_TIMEOUT=2 POLL_SECONDS=1 bash "$WORK/update.sh" \
    >"$WORK/stdout" 2>"$WORK/stderr"
  status=$?
  set -e
}

check() {
  local name=$1
  shift
  if "$@"; then
    passed=$((passed + 1))
  else
    failures=$((failures + 1))
    echo "FAIL: $name" >&2
    echo "  calls: $(tr '\n' ';' <"$WORK/state/calls" 2>/dev/null)" >&2
    echo "  log: $(tail -n 2 "$WORK/update.log" 2>/dev/null | tr '\n' ';')" >&2
  fi
}

called() { grep -qxF "$1" "$WORK/state/calls" 2>/dev/null; }
not_called() { ! grep -qF "$1" "$WORK/state/calls" 2>/dev/null; }
logged() { tail -n 1 "$WORK/update.log" | grep -qE "^[0-9TZ:-]+ $1\$"; }
exited() { [ "$status" -eq "$1" ]; }
no_log() { [ ! -e "$WORK/update.log" ]; }

# 1. Nothing new: no redeploy, no log line, no output.
setup
echo sha256:2.0.0 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
run_update
check 'unchanged exits 0' exited 0
check 'unchanged pulls' called 'docker compose pull -q'
check 'unchanged does not redeploy' not_called 'compose up'
check 'unchanged writes no log' no_log
check 'unchanged is silent' test ! -s "$WORK/stdout" -a ! -s "$WORK/stderr"

# 2. Nothing new, but the running container is unhealthy: keep failing until it is fixed.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.1 >"$WORK/state/running"
echo unhealthy >"$WORK/state/health"
run_update
check 'unhealthy and unchanged exits 1' exited 1
check 'unhealthy and unchanged says so' grep -q 'bubble-breaker 2.0.1 is unhealthy' "$WORK/stderr"
check 'unhealthy and unchanged does not redeploy' not_called 'compose up'

# 3. A new release: redeploy, wait for healthy, prune this repo's images, log the versions.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
run_update
check 'update exits 0' exited 0
check 'update redeploys' called 'docker compose up -d --remove-orphans'
check 'update prunes by source label' called \
  'docker image prune -f --filter label=org.opencontainers.image.source=https://github.com/Obichris11/bubble-breaker'
check 'update logs old -> new' logged '2.0.0 -> 2.0.1'

# 4. The new container never becomes healthy: exit 1 for the DSM email, keep old images.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
echo starting >"$WORK/state/health"
run_update
check 'unhealthy exits 1' exited 1
check 'unhealthy logs the failure' logged 'FAILED 2.0.0 -> 2.0.1: not healthy after 2s'
check 'unhealthy explains on stderr' grep -q 'did not become healthy within 2s' "$WORK/stderr"
check 'unhealthy shows container logs' grep -q 'nginx: \[emerg\] example' "$WORK/stderr"
check 'unhealthy does not prune' not_called 'image prune'

# 5. First run on the NAS: no container yet.
setup
echo sha256:2.0.0 >"$WORK/state/remote"
run_update
check 'first run exits 0' exited 0
check 'first run deploys' called 'docker compose up -d --remove-orphans'
check 'first run logs none -> version' logged 'none -> 2.0.0'

# 6. Rollback: compose.yml pins an older tag, which differs from the running image.
setup
echo sha256:2.0.0 >"$WORK/state/remote"
echo sha256:2.0.1 >"$WORK/state/running"
run_update
check 'rollback redeploys' called 'docker compose up -d --remove-orphans'
check 'rollback logs new -> old' logged '2.0.1 -> 2.0.0'

# 7. A run that is still busy holds the lock: the next one exits 0 without pulling.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
: >"$WORK/.update.lock"
flock "$WORK/.update.lock" sleep 3 &
holder=$!
sleep 0.5
run_update
wait "$holder"
check 'locked exits 0' exited 0
check 'locked does not pull' not_called 'pull'

# 8. Without the compose plugin, the standalone docker-compose binary is used.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
touch "$WORK/state/no-plugin"
run_update
check 'fallback exits 0' exited 0
check 'fallback uses docker-compose' called 'docker-compose pull -q'

# 9. The registry cannot be reached: exit 1 with docker's error, nothing else runs.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
touch "$WORK/state/offline"
run_update
check 'offline exits 1' exited 1
check 'offline shows the pull error' grep -q 'i/o timeout' "$WORK/stderr"
check 'offline does not redeploy' not_called 'compose up'

# 10. The log keeps its last 500 lines.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
for i in $(seq 1 600); do echo "old line $i"; done >"$WORK/update.log"
run_update
check 'log is trimmed to 500 lines' test "$(wc -l <"$WORK/update.log")" -eq 500
check 'log keeps the newest line' logged '2.0.0 -> 2.0.1'

if [ "$failures" -gt 0 ]; then
  echo "update.sh: $failures failed, $passed passed" >&2
  exit 1
fi
echo "update.sh: $passed checks passed"
