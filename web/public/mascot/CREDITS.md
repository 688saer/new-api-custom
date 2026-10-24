# 看板娘素材来源与许可

## 动画片段（`clips/`）

`web/public/mascot/clips/` 下的 106 个透明视频来自
[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，按 **MIT 许可**使用。

原始素材为 640×360 VP9（带 `TAG:ALPHA_MODE=1`），已重新编码为 280px 宽、CRF 40、
保留 alpha 通道，总体积从约 53 MB 降到约 12.8 MB。文件和动画画面的内容没有改动。

重新生成请用 `scripts/compress-pet-assets.sh`。

> **注意**：这批动画里是 dsh-pet 的原角色形象，与本站定制的「泡泡」立绘**不是同一个角色**。
> 两者只在气泡这种小尺寸同框。

## 立绘头像（`portraits/`）

`web/public/mascot/portraits/` 下的 12 张 384×384 PNG 是为本站定制的「泡泡」鲸鱼娘，
使用站内图像生成模型生成，**版权随本站**，不受上面 MIT 条款约束。

## 物理与交互代码

`web/src/components/mascot/physics.ts` 与 `use-mascot-drag.ts` 中的弹簧跟随、
甩动速度估计、飞行积分、落地压扁等算法移植自 dsh-pet，同属 MIT 许可。

---

## MIT License

Copyright (c) 2026 PC2005-cloud

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
