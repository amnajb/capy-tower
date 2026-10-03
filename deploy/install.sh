#!/usr/bin/env bash
# ============================================================================
#  Capy Tower — VPS installer (run from WSL/Linux, inside the git checkout)
#
#       git pull && deploy/install.sh        deploy what is on main
#       deploy/install.sh --dry-run          show what would happen
#
#  The game is static files (index.html, style.css, js/, music/), copied from
#  the commit into DEST. The online race server (server/tower-server.js, no
#  dependencies) is installed as the `capy-tower` systemd service on
#  127.0.0.1:PORT. The arcade (capy-leap's installer) owns nginx and routes
#  /tower/ -> DEST and /tower/ws -> PORT, so after the first install run the
#  arcade installer once to add the routes and the picker card.
#
#  Settings come from deploy/deploy.conf (gitignored); flags override:
#    --host user@vps   --dest /var/www/arcade/tower   --port 8096   --key FILE   --stale
# ============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
HOST=""; DEST="/var/www/arcade/tower"; PORT=8096; SSH_KEY=""; DRY=0; STALE=0
[ -f "$HERE/deploy.conf" ] && . "$HERE/deploy.conf"

c_ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
c_info() { printf '\033[36m==> %s\033[0m\n' "$*"; }
die()    { printf '\033[31m!!  %s\033[0m\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="${2:?}"; shift 2 ;;
    --dest) DEST="${2:?}"; shift 2 ;;
    --port) PORT="${2:?}"; shift 2 ;;
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

# only the game files, straight from the commit (no deploy/, dev/, server/ or .git)
FILES=(index.html style.css manifest.json sw.js icons js music)
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
  sudo chown -R root:root '$DEST'
  sudo find '$DEST' -type d -exec chmod 755 {} +
  sudo find '$DEST' -type f -exec chmod 644 {} +
  sudo rm -rf '$DEST.old'"
c_ok "game files $COMMIT are live in $DEST"

c_info "installing the race server (capy-tower.service on 127.0.0.1:$PORT)"
sed "s|__PORT__|$PORT|" "$HERE/capy-tower.service" | ssh "${SSH_OPTS[@]}" "$HOST" "cat > /tmp/capy-tower.service"
git show HEAD:server/tower-server.js | ssh "${SSH_OPTS[@]}" "$HOST" "set -e
  cat > /tmp/tower-server.js
  command -v node >/dev/null || { echo '!! node is not installed on the server'; exit 1; }
  sudo mkdir -p /opt/capy-tower
  sudo install -m 644 -o root -g root /tmp/tower-server.js /opt/capy-tower/tower-server.js
  sudo install -m 644 -o root -g root /tmp/capy-tower.service /etc/systemd/system/capy-tower.service
  rm -f /tmp/tower-server.js /tmp/capy-tower.service
  sudo systemctl daemon-reload
  sudo systemctl enable capy-tower >/dev/null 2>&1 || true
  sudo systemctl restart capy-tower
  for i in 1 2 3 4 5 6; do sleep 1; curl -s --max-time 2 http://127.0.0.1:$PORT/health >/dev/null && break; done
  curl -s --max-time 3 http://127.0.0.1:$PORT/health || { sudo journalctl -u capy-tower -n 30 --no-pager; exit 1; }
  echo
  grep -qs 'location = /tower/ws' /etc/nginx/sites-enabled/* && echo ROUTED || echo NOT_ROUTED"
c_ok "capy-tower $COMMIT deployed"
echo "If the output above ends in NOT_ROUTED, add the arcade routes once:"
echo "    cd ~/capyleap-arcade && git pull && ./install.sh"
