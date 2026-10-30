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
#   health = what the health check reports, stopped = container exists but is not running,
#   up-fails = `compose up` errors, no-plugin = no `docker compose`.
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
  'compose up -d --remove-orphans')
    [ ! -f "$S/up-fails" ] || { echo 'Error: Bind for 127.0.0.1:18080 failed: port is already allocated' >&2; exit 1; }
    cp "$S/local" "$S/running" ;;
  'image inspect -f {{.Id}} ghcr.io/obichris11/bubble-breaker:latest') cat "$S/local" ;;
  'inspect -f {{.Image}} bubble-breaker') cat "$S/running" 2>/dev/null || exit 1 ;;
  'inspect -f {{.State.Health.Status}} bubble-breaker') cat "$S/health" ;;
  'inspect -f {{.State.Running}} bubble-breaker')
    [ -f "$S/running" ] || exit 1
    if [ -f "$S/stopped" ]; then echo false; else echo true; fi ;;
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

# 4. The new container never becomes healthy: exit 1 so DSM marks the run failed, keep old images.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
echo starting >"$WORK/state/health"
run_update
check 'unhealthy exits 1' exited 1
check 'unhealthy logs the failure' logged 'FAILED 2.0.0 -> 2.0.1: not healthy after 2s'
check 'unhealthy explains on stderr' grep -q '2.0.0 -> 2.0.1 failed: not healthy after 2s' "$WORK/stderr"
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

# 7. Without the compose plugin, the standalone docker-compose binary is used.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
touch "$WORK/state/no-plugin"
run_update
check 'fallback exits 0' exited 0
check 'fallback uses docker-compose' called 'docker-compose pull -q'

# 8. The registry cannot be reached: exit 1 with docker's error, nothing else runs.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
touch "$WORK/state/offline"
run_update
check 'offline exits 1' exited 1
check 'offline shows the pull error' grep -q 'i/o timeout' "$WORK/stderr"
check 'offline does not redeploy' not_called 'compose up'

# 9. The log keeps its last 500 lines.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
for i in $(seq 1 600); do echo "old line $i"; done >"$WORK/update.log"
run_update
check 'log is trimmed to 500 lines' test "$(wc -l <"$WORK/update.log")" -eq 500
check 'log keeps the newest line' logged '2.0.0 -> 2.0.1'

# 10. Nothing new, but the container is stopped: fail every run, do not start it (it may be on purpose).
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.1 >"$WORK/state/running"
touch "$WORK/state/stopped"
run_update
check 'stopped exits 1' exited 1
check 'stopped says so' grep -q 'bubble-breaker 2.0.1 is not running' "$WORK/stderr"
check 'stopped does not redeploy' not_called 'compose up'

# 11. `compose up` itself fails (port taken, name clash): log it like a failed health check.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
touch "$WORK/state/up-fails"
run_update
check 'compose up failure exits 1' exited 1
check 'compose up failure is logged' logged 'FAILED 2.0.0 -> 2.0.1: compose up failed'
check 'compose up failure shows the error' grep -q 'port is already allocated' "$WORK/stderr"
check 'compose up failure does not prune' not_called 'image prune'

# 12. A deploy logged FAILED that became healthy later: log the recovery and prune once.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.1 >"$WORK/state/running"
echo '2026-10-29T12:00:00Z FAILED 2.0.0 -> 2.0.1: not healthy after 90s' >"$WORK/update.log"
run_update
check 'recovered exits 0' exited 0
check 'recovered is logged' logged 'recovered 2.0.1'
check 'recovered prunes' called \
  'docker image prune -f --filter label=org.opencontainers.image.source=https://github.com/Obichris11/bubble-breaker'
check 'recovered does not redeploy' not_called 'compose up'
run_update
check 'recovered logs once' test "$(grep -c recovered "$WORK/update.log")" -eq 1

if [ "$failures" -gt 0 ]; then
  echo "update.sh: $failures failed, $passed passed" >&2
  exit 1
fi
echo "update.sh: $passed checks passed"
