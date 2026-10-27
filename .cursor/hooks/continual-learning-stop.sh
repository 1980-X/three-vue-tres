#!/usr/bin/env bash
set -euo pipefail

find_bun() {
  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return 0
  fi

  for candidate in \
    "${HOME}/.bun/bin/bun" \
    "${HOME}/.cursor-server/bin/linux-x64/bin/bun"; do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

BUN="$(find_bun)" || {
  echo '{"followup_message":""}' >&2
  echo '{}'
  exit 0
}

exec "${BUN}" run .cursor/hooks/continual-learning-stop.ts
