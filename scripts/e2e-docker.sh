#!/usr/bin/env bash
# Runs Playwright in the image CI uses, so screenshots render exactly like CI (04-quality):
#   npm run e2e:docker -- --project=visual --update-snapshots
# node_modules stays in a named volume, so a macOS checkout keeps its own. Extra Docker flags
# (a proxy in a cloud session) go in E2E_DOCKER_ARGS.
set -euo pipefail

IMAGE=mcr.microsoft.com/playwright:v1.64.1-noble@sha256:2f05f8a734509a7b3f26a912639488ee08f58a7b292d14d62271bcff9038768f

# shellcheck disable=SC2086
docker run --rm --ipc=host -v "$PWD:/work" -v bb-e2e-node-modules:/work/node_modules -w /work \
  ${E2E_DOCKER_ARGS:-} "$IMAGE" \
  bash -c 'npm ci && npm run build:e2e && npx playwright test -c e2e "$@"' _ "$@"
