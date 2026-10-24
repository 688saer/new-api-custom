#!/bin/bash
# 把 dsh-pet 的透明动画素材压缩后装进前端 public 目录。
#
# 两步产物：
#   1. /root/pet-final/*.webm   —— 保留中文名的压缩结果
#   2. web/public/mascot/clips/clip-NNN.webm —— go:embed 能接受的名字
#
# 为什么必须改名：go:embed 拒绝非 ASCII 文件名，中文名会让整个镜像构建失败：
#   main.go:44:12: pattern web/dist: cannot embed file .../是啊，吃什么.webm: invalid name
#
# 用法：在服务器上跑，先确保 dsh-pet 已克隆到 $SRC。
set -u

SRC=/root/dsh-pet/dsh-pet/assets/webm
OUT=/root/pet-final
CLIPS=/root/newapi-build/web/public/mascot/clips

mkdir -p "$OUT" "$CLIPS"

# ── 1. 压缩 ────────────────────────────────────────────────────────────────
# 关键：-c:v libvpx-vp9 必须同时出现在**输入前面**当解码器。
# ffmpeg 原生 vp9 解码器读不到 TAG:ALPHA_MODE 的 BlockAdditional 透明通道，
# 会报成 yuv420p，再编码出去就是不透名黑底 —— 体积画质都正常，只有透明没了。
docker run --rm -v "$SRC":/src -v "$OUT":/out --entrypoint bash jrottenberg/ffmpeg:latest -c '
set -u
ok=0; fail=0
for f in /src/*.webm; do
  name=$(basename "$f" .webm)
  ffmpeg -v error -c:v libvpx-vp9 -i "$f" \
    -c:v libvpx-vp9 -vf "scale=280:-2" -crf 40 -b:v 0 -an \
    -auto-alt-ref 0 -pix_fmt yuva420p \
    -y "/out/$name.webm" 2>/tmp/err.txt
  if [ $? -eq 0 ] && [ -s "/out/$name.webm" ]; then
    ok=$((ok+1))
  else
    fail=$((fail+1))
    echo "FAIL: $name"
    head -3 /tmp/err.txt
  fi
done
echo "压缩完成: ok=$ok fail=$fail"
'

# ── 2. 中文名 → ASCII 序号 ─────────────────────────────────────────────────
# 映射写进 clip-files.ts，代码和测试仍用可读的中文名。
python3 - <<'PY'
import json
import os
import shutil

src = '/root/pet-final'
dst = '/root/newapi-build/web/public/mascot/clips'
os.makedirs(dst, exist_ok=True)

names = sorted(f[:-5] for f in os.listdir(src) if f.endswith('.webm'))
mapping = {name: 'clip-%03d' % index for index, name in enumerate(names, 1)}

for name, slug in mapping.items():
    shutil.copyfile(os.path.join(src, name + '.webm'), os.path.join(dst, slug + '.webm'))

with open('/root/clip-map.json', 'w', encoding='utf-8') as handle:
    json.dump(mapping, handle, ensure_ascii=False, indent=1)

print('已装 %d 个片段 → %s' % (len(mapping), dst))
PY

# ── 3. 校验 alpha 真的还在 ────────────────────────────────────────────────
# 只检查编码参数不够：alpha 丢失时参数照样像是对的。这里检查容器里仍有
# ALPHA_MODE 标记，浏览器实测另外做（把视频铺在红底上数红像素）。
miss=0
for f in "$CLIPS"/*.webm; do
  strings "$f" | grep -q ALPHA_MODE || { echo "缺 alpha: $f"; miss=$((miss + 1)); }
done
echo "alpha 校验: $(ls "$CLIPS"/*.webm | wc -l) 个片段，缺失 $miss 个"
echo "总体积: $(du -sh "$CLIPS" | cut -f1)"
echo
echo "下一步：重新生成 web/src/components/mascot/clip-files.ts 并重建镜像。"
