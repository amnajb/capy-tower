#!/usr/bin/env bash
# ============================================================================
#  Capy Tower — VPS installer (run from WSL/Linux, inside the git checkout)
#
#       git pull && deploy/install.sh        deploy what is on main
#       deploy/install.sh --dry-run          show what would happen
#
#  Capy Tower is static (index.html, game.js, style.css), so this just copies
#  the committed files into DEST. The arcade (capy-leap's installer) owns
#  nginx and routes /tower/ -> DEST, so after the first install run the
#  arcade installer once to add the route and the picker card.
#
#  Settings come from deploy/deploy.conf (gitignored); flags override:
#    --host user@vps   --dest /var/www/arcade/tower   --key FILE   --stale
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
HOST=""; DEST="/var/www/arcade/tower"; SSH_KEY=""; DRY=0; STALE=0
[ -f "$HERE/deploy.conf" ] && . "$HERE/deploy.conf"

c_ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
c_info() { printf '\033[36m==> %s\033[0m\n' "$*"; }
die()    { printf '\033[31m!!  %s\033[0m\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="${2:?}"; shift 2 ;;
    --dest) DEST="${2:?}"; shift 2 ;;
    --key|-i) SSH_KEY="${2:?}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --stale) STALE=1; shift ;;
    -h|--help) awk 'NR>1{ if(/^#/){sub(/^# ?/,"");print} else exit }' "$0"; exit 0 ;;
    *) die "unknown option: $1  (try --help)" ;;
  esac
done
[ -n "$HOST" ] || die "no host: cp deploy/deploy.conf.example deploy/deploy.conf and set HOST (or pass --host user@vps)"

cd "$REPO"
if [ "$STALE" = 0 ]; then
  git fetch -q origin main
  [ "$(git rev-list --count HEAD..origin/main)" = 0 ] \
    || die "origin/main has newer commits: git pull first (or --stale)"
fi
COMMIT="$(git rev-parse --short HEAD)"
c_info "deploying capy-tower $COMMIT to $HOST:$DEST"

# only the game files, straight from the commit (no deploy/, no .git)
FILES=(index.html game.js style.css)
if [ "$DRY" = 1 ]; then
  printf '    %s\n' "${FILES[@]}"; c_ok "dry run: nothing was changed."; exit 0
fi

SSH_OPTS=(-o ConnectTimeout=20)
[ -n "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")
git archive --format=tar HEAD "${FILES[@]}" | ssh "${SSH_OPTS[@]}" "$HOST" "set -e
  NEW=\$(mktemp -d)
  tar -xf - -C \"\$NEW\"
  echo '$COMMIT' > \"\$NEW/VERSION\"
  sudo mkdir -p '$(dirname "$DEST")'
  sudo rm -rf '$DEST.old'
  [ -d '$DEST' ] && sudo mv '$DEST' '$DEST.old'
  sudo mv \"\$NEW\" '$DEST'
  sudo chmod 755 '$DEST'; sudo chmod 644 '$DEST'/*
  sudo chown -R root:root '$DEST'
  sudo rm -rf '$DEST.old'"
c_ok "capy-tower $COMMIT is live in $DEST (served at /tower/ once the arcade routes it)"
