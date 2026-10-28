#!/usr/bin/env bash
# SessionStart hook: make sure Claude Code cloud sessions have Node >= 24.15
# (Angular 22 requirement). No-op on local machines.
set -u

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

REQUIRED_MAJOR=24
REQUIRED_MINOR=15
NVM_VERSION=v0.40.3

node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local version major minor
  version=$(node -v | sed 's/^v//')
  major=${version%%.*}
  minor=$(echo "$version" | cut -d. -f2)
  [ "$major" -gt "$REQUIRED_MAJOR" ] && return 0
  [ "$major" -eq "$REQUIRED_MAJOR" ] && [ "$minor" -ge "$REQUIRED_MINOR" ]
}

warn() {
  echo "cloud-setup: $*" >&2
  exit 0
}

if ! node_ok; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | PROFILE=/dev/null bash >/dev/null 2>&1 ||
      warn "nvm install failed; Node is $(node -v 2>/dev/null || echo missing)"
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install "$REQUIRED_MAJOR" >/dev/null 2>&1 || warn "nvm install $REQUIRED_MAJOR failed"
  nvm alias default "$REQUIRED_MAJOR" >/dev/null 2>&1
  node_bin=$(dirname "$(nvm which "$REQUIRED_MAJOR")")
  export PATH="$node_bin:$PATH"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"$node_bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
  fi
  node_ok || warn "Node $(node -v) is still below $REQUIRED_MAJOR.$REQUIRED_MINOR"
fi

echo "cloud-setup: node $(node -v), npm $(npm -v)"
