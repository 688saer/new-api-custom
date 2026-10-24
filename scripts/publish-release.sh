#!/bin/bash
# 创建/更新 GitHub Release 并上传 Docker 镜像包与校验和。
# 用法：TOKEN=<pat> bash publish-release.sh <tag> <release-title> <body-file> <tarball>
set -eu

TAG="${1:?tag required}"
TITLE="${2:?title required}"
BODY_FILE="${3:?body file required}"
TARBALL="${4:?tarball required}"
REPO="688saer/new-api-custom"
API="https://api.github.com/repos/$REPO"
TOKEN="${TOKEN:?TOKEN env required}"
NAME=$(basename "$TARBALL")

api() { curl -s -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" "$@"; }

json_field() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$1',''))"; }

asset_id_by_name() {
  api "$API/releases/$1/assets" | python3 -c "
import json, sys
target = sys.argv[1]
for asset in json.load(sys.stdin):
    if asset.get('name') == target:
        print(asset['id'])
        break
" "$2"
}

upload_asset() {
  local release_id="$1" file="$2" name="$3" ctype="$4"
  local old
  old=$(asset_id_by_name "$release_id" "$name")
  if [ -n "$old" ]; then
    echo "  删除旧资产 $name (id=$old)"
    api -X DELETE "$API/releases/assets/$old" > /dev/null
  fi
  api -X POST \
    -H "Content-Type: $ctype" \
    --data-binary "@$file" \
    "https://uploads.github.com/repos/$REPO/releases/$release_id/assets?name=$name" \
    | json_field name
}

echo "== 创建/更新 release $TAG =="
RELEASE_ID=$(api "$API/releases/tags/$TAG" | json_field id)

if [ -n "$RELEASE_ID" ]; then
  echo "已存在 id=$RELEASE_ID，更新内容"
  python3 -c "
import json, sys
print(json.dumps({
    'tag_name': sys.argv[1],
    'name': sys.argv[2],
    'body': open(sys.argv[3], encoding='utf-8').read(),
    'draft': False,
    'prerelease': False,
}))
" "$TAG" "$TITLE" "$BODY_FILE" \
    | api -X PATCH -d @- "$API/releases/$RELEASE_ID" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('release:', d.get('html_url'))"
else
  python3 -c "
import json, sys
print(json.dumps({
    'tag_name': sys.argv[1],
    'name': sys.argv[2],
    'body': open(sys.argv[3], encoding='utf-8').read(),
    'draft': False,
    'prerelease': False,
}))
" "$TAG" "$TITLE" "$BODY_FILE" \
    | api -X POST -d @- "$API/releases" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('release:', d.get('html_url'))"
  RELEASE_ID=$(api "$API/releases/tags/$TAG" | json_field id)
fi

if [ -z "$RELEASE_ID" ]; then
  echo "拿不到 release id，退出"
  exit 1
fi

echo "== 上传镜像包 $NAME =="
upload_asset "$RELEASE_ID" "$TARBALL" "$NAME" "application/octet-stream"

echo "== 上传校验和 =="
sha256sum "$TARBALL" | awk '{print $1"  '"$NAME"'"}' > /tmp/checksums-sha256.txt
md5sum "$TARBALL" | awk '{print $1"  '"$NAME"'"}' > /tmp/checksums-md5.txt
upload_asset "$RELEASE_ID" /tmp/checksums-sha256.txt checksums-sha256.txt "text/plain"
upload_asset "$RELEASE_ID" /tmp/checksums-md5.txt checksums-md5.txt "text/plain"

echo "== 完成 =="
api "$API/releases/$RELEASE_ID" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('draft:', d.get('draft'), '| tag:', d.get('tag_name'))
for a in d.get('assets', []):
    print(' -', a['name'], a['size'], 'bytes')
"
