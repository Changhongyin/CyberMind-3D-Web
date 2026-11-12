#!/usr/bin/env bash
# 把 source/web/ 发布到 GitHub Pages 的 gh-pages 分支。
#
# 用法:
#   ./deploy/publish-github-pages.sh
#   PAGES_REMOTE=git@github.com:org/repo.git PAGES_BRANCH=gh-pages ./deploy/publish-github-pages.sh
#
# 说明:
#   - 网站是纯静态文件，无构建步骤；脚本只复制 source/web/ 到临时目录再推送到分支。
#   - 使用 --force 覆盖远端分支，因此 gh-pages 上不要手工保留文件（本脚本会整体替换）。
#   - 发布后 GitHub Pages 会自动重建，通常 1–2 分钟生效。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/source/web"
REMOTE="${PAGES_REMOTE:-$(git -C "$ROOT" remote get-url origin)}"
BRANCH="${PAGES_BRANCH:-gh-pages}"
NAME="${GIT_AUTHOR_NAME:-Changhongyin}"
EMAIL="${GIT_AUTHOR_EMAIL:-2178804664@qq.com}"

[ -d "$SRC" ] || { echo "error: missing $SRC" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp -R "$SRC/." "$WORK/"
# 跳过 Jekyll，保证文件原样发布
: > "$WORK/.nojekyll"

git -C "$WORK" init -q
git -C "$WORK" add -A
git -C "$WORK" -c user.name="$NAME" -c user.email="$EMAIL" commit -qm "Publish JIXIN site $(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "publishing $(find "$SRC" -type f | wc -l | tr -d ' ') files to $REMOTE ($BRANCH)"
git -C "$WORK" push --force "$REMOTE" "HEAD:$BRANCH"
echo "done: https://changhongyin.github.io/CyberMind-3D-Web/"
