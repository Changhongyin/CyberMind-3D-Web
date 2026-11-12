#!/usr/bin/env bash
# 校验线上站点与本地 source/web/ 是否逐文件一致（HTTP 状态 + SHA-256）。
#
# 用法:
#   ./deploy/verify-site.sh
#   SITE_URL=https://changhongyin.github.io/CyberMind-3D-Web ./deploy/verify-site.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/source/web"
BASE="${SITE_URL:-https://changhongyin.github.io/CyberMind-3D-Web}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

ok=0; fail=0
while IFS= read -r f; do
  rel="${f#"$SRC"/}"
  out="$TMP/$rel"
  mkdir -p "$(dirname "$out")"
  code="$(curl -s -o "$out" -w '%{http_code}' --max-time 300 "$BASE/$rel" || echo 000)"
  local_hash="$(hash_file "$f")"
  remote_hash="$(hash_file "$out" 2>/dev/null || echo '')"
  if [ "$code" = "200" ] && [ "$local_hash" = "$remote_hash" ]; then
    printf 'OK    %s\n' "$rel"; ok=$((ok + 1))
  else
    printf 'FAIL  %s (http %s)\n' "$rel" "$code"; fail=$((fail + 1))
  fi
done < <(find "$SRC" -type f | sort)

echo "----"
echo "site: $BASE"
echo "verified_ok=$ok failed=$fail"
[ "$fail" -eq 0 ]
