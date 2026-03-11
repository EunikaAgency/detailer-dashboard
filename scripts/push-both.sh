#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/push-both.sh [branch]

Pushes a branch to both remotes:
- origin (default account: jhonivancuaco)
- eunika (default account: EunikaAgency)

If the first push fails, the script tries switching GitHub CLI account
for that remote and retries once.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run this inside a git repository."
  exit 1
fi

branch="${1:-$(git branch --show-current)}"
if [[ -z "$branch" ]]; then
  echo "Error: could not determine current branch. Pass one explicitly."
  exit 1
fi

for remote in origin eunika; do
  if ! git remote get-url "$remote" >/dev/null 2>&1; then
    echo "Error: missing remote '$remote'."
    exit 1
  fi
done

declare -A REMOTE_ACCOUNT=(
  [origin]="jhonivancuaco"
  [eunika]="EunikaAgency"
)

active_account=""
if command -v gh >/dev/null 2>&1; then
  # Ensure git can use GH CLI credentials.
  gh auth setup-git >/dev/null 2>&1 || true
  active_account="$(gh auth status 2>/dev/null | awk '
    /Logged in to github.com account/ { acct=$7 }
    /Active account: true/ { print acct; exit }
  ')"
fi

restore_account() {
  if [[ -n "$active_account" ]] && command -v gh >/dev/null 2>&1; then
    current_account
    current_account="$(gh auth status 2>/dev/null | awk '
      /Logged in to github.com account/ { acct=$7 }
      /Active account: true/ { print acct; exit }
    ')"
    if [[ -n "$current_account" && "$current_account" != "$active_account" ]]; then
      gh auth switch -u "$active_account" >/dev/null
      echo "Restored active GitHub account: $active_account"
    fi
  fi
}
trap restore_account EXIT

push_remote() {
  local remote="$1"
  local account="${REMOTE_ACCOUNT[$remote]}"

  echo "Pushing '$branch' to '$remote'..."
  if git push "$remote" "$branch"; then
    echo "OK: $remote"
    return 0
  fi

  if ! command -v gh >/dev/null 2>&1; then
    echo "Error: push to '$remote' failed and 'gh' is not available for retry."
    return 1
  fi

  echo "Retrying '$remote' with GH account '$account'..."
  gh auth switch -u "$account" >/dev/null
  gh auth setup-git >/dev/null 2>&1 || true
  git push "$remote" "$branch"
  echo "OK: $remote (after account switch)"
}

push_remote origin
push_remote eunika

echo "Done: pushed '$branch' to origin and eunika."
