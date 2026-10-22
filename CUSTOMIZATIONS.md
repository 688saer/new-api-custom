# new-api 定制版 — 运维与升级手册

> 本文档描述本仓库相对官方 new-api 的**全部改动**、**升级流程**和**部署方式**。
>
> ⚠️ 本文件包含服务器地址等基础设施信息，**仓库必须保持 Private**。

---

## 一、这是什么

本仓库是 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的定制分支，在官方 **v1.0.0-rc.46** 基础上叠加了五个自有功能。

它不是一个 fork 后随意修改的副本，而是用 **git 三向合并**维护的：

```
master ──●  rc.45 官方基线
         │
         ├──────────────┐
         │              │
ours ────●  rc.45 + 我们的五个功能
         │              │
         │              ●  theirs  rc.46 官方
         │              │
         └──────●  merge  ← 当前 HEAD（rc.46 + 我们的功能）
```

好处：以后官方每发一版，只要把新版本提交到 `theirs` 分支再 merge，**上游改动和我们的改动自动合到一起**，不需要人工比对哪个文件是谁改的。

| 分支 | 含义 | 谁维护 |
|---|---|---|
| `master` | 最初的上游基线（rc.45） | 冻结，不再使用 |
| `theirs` | **上游镜像**，永远等于最新官方版本 | 每次升级时更新 |
| `ours` | **我们的工作分支**，= 上游 + 五个自定义功能 | 日常提交都在这 |

当前状态：

| 项目 | 值 |
|---|---|
| 官方版本 | v1.0.0-rc.46 |
| 上游提交 | `e82f634` upstream v1.0.0-rc.46 |
| 合并提交 | `2566df2` merge upstream v1.0.0-rc.46 into our customizations |
| 当前 HEAD | `31c2cef` test: update sidebar assertion for custom menu items |
| 文件数 | 2722 |
| Go 版本 | 1.26.10（rc.46 起强制，见 CVE-2026-111943） |

---

## 二、部署信息（快速参考）

| 项目 | 值 |
|---|---|
| 站点 | `https://<your-domain>/` |
| 服务器 | `<server-address>`（BaoTa 面板） |
| 构建目录 | `/root/newapi-build` |
| 合并仓库 | `/root/merge/work` |
| 编排文件 | `/www/dk_project/dk_app/newapi/newapi_hC8X/docker-compose.yml` |
| 容器 | `newapi_hc8x-new-api-1` / `newapi_hc8x-mysql-1` |
| 内部端口 | 3000 |
| 数据库 | MySQL 8.2，库名 `new-api` |
| 缓存 | Redis |
| 时区 | Asia/Shanghai |
| 镜像命名 | `new-api-lottery:<tag>` |

> 数据库密码、管理员密码、渠道密钥**不在本仓库中**，见服务器 `docker-compose.yml` 与后台。

---

## 三、自定义功能清单

五个功能全部是**原生集成**（不是 iframe 嵌入），复用官方组件、主题和 i18n。

### 3.1 幸运抽奖 `/lottery`

用户每日免费抽奖，可单抽或十连抽。

- **后端**：`controller/lottery.go`、`model/lottery.go`（498 行，含概率与开奖逻辑）
- **前端**：`web/src/features/lucky-bonus/`
- **数据表**：`lottery_draws`（抽奖记录）、`lottery_rounds`（奖池轮次）
- **配置项**：`lottery_setting.*`

| 配置项 | 含义 |
|---|---|
| `enabled` | 总开关 |
| `daily_free_draws` | 每日免费次数 |
| `single_cost_quota` | 单抽消耗额度 |
| `multi_cost_quota` | 十连消耗额度 |
| `enable_multi` | 是否开放十连 |
| `require_no_draw_today_for_multi` | 十连前必须当日未抽过 |
| `prizes` | 奖池，`[{quota, weight}]` 权重抽奖 |
| `public_wins_limit` | 中奖公示条数 |
| `min_win_quota_for_public` | 进入公示的最低额度 |

**关键点**：`prizes` 的 `weight` 是相对权重，不是百分比。`{quota:0, weight:55}` 表示 55 份"谢谢参与"。

### 3.2 福利宝箱 `/welfare-chests`

按周消费额解锁的宝箱，两个档位（`xiaoshuai_ge` 小帅鸽 / `hei_dashuai` 黑大帅）。

- **后端**：`controller/welfare_chest.go`、`model/welfare_chest.go`（398 行）
- **前端**：`web/src/features/lucky-bonus/components/welfare-chests-page.tsx`
- **数据表**：`welfare_chest_claims`
- **配置项**：`welfare_chest_setting.*`

| 配置项 | 含义 |
|---|---|
| `enabled` | 总开关 |
| `can_open_any` | 是否允许任选档位 |
| `unlimited_open` | 无限开启（测试用，生产慎开） |
| `choose_one_per_week` | 每周只能选一个档位 |
| `max_quota_limit` | 单次奖励上限，0 = 不限 |
| `weekly_log_lookback` | 统计消费回看天数 |
| `xiaoshuai_ge` / `hei_dashuai` | 各档位的门槛、奖励区间等 JSON |

### 3.3 福利 API 页 `/welfare-apis`

公开或登录可见的免费 API 目录，展示端点、可用模型。

- **后端**：`controller/welfare_api.go`
- **前端**：`web/src/features/welfare-api/`
- **配置项**：`welfare_api_setting.*`

| 配置项 | 含义 |
|---|---|
| `enabled` | 总开关 |
| `title` / `subtitle` / `notice` | 页面文案 |
| `require_login` | 是否要求登录才能看 |
| `apis` | API 列表 JSON（含 id/name/描述/模型） |

### 3.4 渠道可用性 `/service-status`

实时探测本站渠道，展示在线率与延迟。

- **后端**：`controller/service_status.go`（378 行）、`model/service_status.go`（350 行）、`service/service_status_probe.go`（320 行，后台探测协程）
- **前端**：`web/src/features/service-status/`
- **数据表**：`service_status_samples`
- **配置项**：`service_status_setting.*`

| 配置项 | 含义 |
|---|---|
| `enabled` | 总开关 |
| `probe_interval_minutes` | 探测间隔（分钟） |
| `display_hours` | 页面展示时间窗（小时） |
| `sample_retention_days` | 样本保留天数 |
| `show_latency` | 是否显示延迟 |
| `require_login` | 是否要求登录 |
| `targets` | 探测目标列表 JSON |

**关键点**：探测 worker 在 `main.go` 中启动：

```go
// 渠道可用性探测
service.StartServiceStatusProbeWorker()
```

改动探测目标或开关后，`controller/option.go` 会**立即触发一轮探测**，避免页面长时间空白：

```go
if option.Key == "service_status_setting.targets" || option.Key == "service_status_setting.enabled" {
    service.TriggerServiceStatusProbeAsync()
}
```

### 3.5 无限画布 `/canvas`

基于本站模型的 AI 绘图工作台，可拖拽、缩放、加便签、图生图。

- **后端**：无（纯前端，直接调 `/v1/images/*`）
- **前端**：`web/src/features/canvas/`（约 1900 行）

| 文件 | 职责 |
|---|---|
| `canvas-workspace.tsx` | 编排：请求、节点布局、快捷键 |
| `api.ts` | 调 `/v1/images/generations`、`/v1/images/edits`、`/api/pricing`、`/api/token/*` |
| `components/canvas-board.tsx` | 画布容器：平移、缩放、点阵背景、缩放控件 |
| `components/canvas-node-frame.tsx` | 节点通用外壳：定位、拖拽、选中 |
| `components/canvas-image-node.tsx` | 图片节点 + 操作菜单（重生成/参考图/下载/删除） |
| `components/canvas-text-node.tsx` | 便签节点（双击编辑） |
| `components/canvas-prompt-panel.tsx` | 左侧面板：提示词、密钥、模型、尺寸、数量 |
| `hooks/use-canvas-board.ts` | 状态：节点、视口、增删改、500ms 防抖持久化 |
| `lib/board-storage.ts` | IndexedDB 存储（库 `newapi-canvas`，表 `boards`） |
| `types.ts` | `CanvasNode = CanvasImageNode \| CanvasTextNode` 联合类型 |

**设计决策（重要）**：

1. **API 密钥不落盘**。密钥按需通过 `POST /api/token/:id/key` 取一次，只存在内存 `useRef` 的 Map 里，页面关闭即消失。这修掉了原 `infinite-canvas` 把密钥写 localStorage 的问题。
2. **图片存 IndexedDB，不存 localStorage**。1024×1024 的 b64 图片约 0.8–1.3 MB，localStorage 5 MB 上限会瞬间爆掉。
3. **只做图**。只接了 `/v1/images/generations` 和 `/v1/images/edits`，没有视频/音频/渠道管理。

**已知限制**：

- 图片存在**浏览器本地**，换浏览器或清缓存就没了。要跨设备需要后端加表。
- 图生图走 `/v1/images/edits`，上游偶发 `connection reset by peer`，重试即可（见第十节）。

---

## 四、代码结构：哪些是我们的

### 新增文件（纯新增，升级不会冲突）

**后端**

```
controller/lottery.go                              75
controller/welfare_api.go                          96
controller/welfare_chest.go                        67
controller/service_status.go                      378
model/lottery.go                                  498
model/welfare_chest.go                            398
model/service_status.go                           350
service/service_status_probe.go                   320
setting/operation_setting/lottery_setting.go       74
setting/operation_setting/welfare_api_setting.go   51
setting/operation_setting/welfare_chest_setting.go 84
setting/operation_setting/service_status_setting.go 207
```

**前端**

```
web/src/features/canvas/                  ~1900 行
web/src/features/lucky-bonus/             ~1520 行
web/src/features/service-status/          ~985 行
web/src/features/welfare-api/             ~540 行
web/src/features/system-settings/general/lottery-settings-section.tsx
web/src/features/system-settings/general/welfare-api-settings-section.tsx
web/src/features/system-settings/general/welfare-api-entry-dialog.tsx
web/src/features/system-settings/general/welfare-chest-settings-section.tsx
web/src/features/system-settings/general/service-status-settings-section.tsx
web/src/features/system-settings/general/service-status-target-dialog.tsx
web/src/features/system-settings/general/service-status-target-row.tsx
web/src/routes/_authenticated/canvas/index.tsx
web/src/routes/_authenticated/lottery/index.tsx
web/src/routes/_authenticated/welfare-chests/index.tsx
web/src/routes/service-status/index.tsx
web/src/routes/welfare-apis/index.tsx
web/public/static/welfare-chests/        （图片资源）
```

### 修改的官方文件（升级时唯一可能冲突的地方）

一共 **11 个**，每处改动都很小、很集中：

| 文件 | 改动内容 |
|---|---|
| `main.go` | 启动探测 worker（3 行） |
| `model/main.go` | AutoMigrate 注册 4 张新表（4 行） |
| `router/api-router.go` | 注册抽奖/宝箱/福利API/可用性路由（约 19 行） |
| `router/web-router.go` | `WebAssets` 结构体挪到文件末尾（纯格式） |
| `controller/option.go` | 配置变更后触发探测（4 行） |
| `web/src/hooks/use-sidebar-data.ts` | 侧边栏 4 个菜单项 |
| `web/src/hooks/use-sidebar-config.ts` | 侧边栏模块开关默认值 |
| `web/src/lib/nav-modules.ts` | 顶部导航模块 `welfareApi`、`serviceStatus` |
| `web/src/features/system-settings/types.ts` | 新增配置项的 TS 类型 |
| `web/src/routeTree.gen.ts` | 路由树（构建时自动生成） |
| `web/src/i18n/locales/*.json` × 7 | 254 条自定义文案 |

> `web/src/routeTree.gen.ts` 是 TanStack Router 构建时自动生成的，**不要手工改**，冲突时直接接受上游版本再跑一次 `bun run build` 即可重新生成。

---

## 五、数据库

### 自定义表（4 张）

| 表 | 用途 |
|---|---|
| `lottery_draws` | 抽奖记录 |
| `lottery_rounds` | 奖池轮次 |
| `welfare_chest_claims` | 宝箱领取记录 |
| `service_status_samples` | 可用性探测样本 |

全部通过 `model/main.go` 的 `AutoMigrate` 自动建表，**无需手工执行 SQL**。

### 自定义配置项

存在 `options` 表，前缀区分：

```
lottery_setting.*
welfare_chest_setting.*
welfare_api_setting.*
service_status_setting.*
```

`service_status_samples` 会持续增长，按 `sample_retention_days` 清理（默认 30 天）。

### 备份

```bash
docker exec newapi_hc8x-mysql-1 mysqldump -uroot -p<密码> \
  --single-transaction --quick new-api | gzip > backup-$(date +%F).sql.gz
```

**升级前必须备份。** 本次 rc.45→rc.46 升级前的备份在 `/root/dbbackup/`。

---

## 六、升级流程（核心）

### 6.1 前置检查

```bash
# 磁盘（构建需要约 5 GB 空闲）
df -h /

# 当前版本
docker run --rm --entrypoint /new-api new-api-lottery:<当前tag> --version

# 清理旧镜像和构建缓存（否则大概率 no space left on device）
docker images new-api-lottery
docker builder prune -af
```

### 6.2 完整升级步骤

假设要升到 `v1.0.0-rc.47`：

```bash
# ── 1. 下载新版 ──────────────────────────────
cd /root/merge
curl -sSL -o rc47.tar.gz \
  https://codeload.github.com/QuantumNous/new-api/tar.gz/refs/tags/v1.0.0-rc.47
mkdir -p rc47 && tar -xzf rc47.tar.gz -C rc47 --strip-components=1
grep -m1 '"version"' rc47/web/package.json
grep "FROM golang" rc47/Dockerfile        # 记下 Go 版本

# ── 2. 更新上游镜像分支 theirs ────────────────
cd /root/merge/work
git checkout theirs
rsync -a --delete --exclude '.git' /root/merge/rc47/ ./
git add -A
git commit -m "upstream v1.0.0-rc.47"

# ── 3. 合并到我们的分支 ──────────────────────
git checkout ours
git merge theirs
# 如果报冲突：
#   git diff --name-only --diff-filter=U    # 看哪些文件冲突
#   手工解决 → git add <file> → git commit

# ── 4. 同步到构建目录 ────────────────────────
cd /root/newapi-build
rsync -a --delete \
  --exclude 'web/node_modules' \
  --exclude 'web/dist' \
  --exclude '.git' \
  /root/merge/work/ ./

# ── 5. 更新版本号 ────────────────────────────
echo "1.0.0-rc.47" > VERSION

# ── 6. 装依赖 + 类型检查 ─────────────────────
cd web
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun run typecheck
bunx vitest run

# ── 7. 构建镜像 ──────────────────────────────
cd /root/newapi-build
docker build --network host -t new-api-lottery:rc47 .

# ── 8. 备份数据库 ────────────────────────────
docker exec newapi_hc8x-mysql-1 mysqldump -uroot -p<密码> \
  --single-transaction --quick new-api | gzip > /root/dbbackup/pre-rc47-$(date +%s).sql.gz

# ── 9. 切换镜像 ──────────────────────────────
cd /www/dk_project/dk_app/newapi/newapi_hC8X
cp docker-compose.yml docker-compose.yml.bak.$(date +%Y%m%d%H%M%S)
sed -i 's|image: new-api-lottery:rc46|image: new-api-lottery:rc47|' docker-compose.yml
docker compose up -d new-api

# ── 10. 验证（见第九节）──────────────────────
```

### 6.3 冲突处理原则

冲突几乎只会出现在第四节列的那 11 个文件里。判断方法：

```bash
# 看上游在这个文件改了什么
git log --oneline theirs -- router/api-router.go
git diff master theirs -- router/api-router.go

# 看我们改了什么
git diff master ours -- router/api-router.go
```

**处理原则**：以**上游的新结构**为骨架，把我们的改动**重新插进去**。我们的改动都是"在某个位置加几行"，重新插入很直接。

最常见的冲突是 `router/api-router.go`（上游常改路由）和 `i18n/locales/*.json`（上游常加文案）。

**i18n 冲突的处理**：JSON 冲突很烦，建议直接用脚本合并——

```bash
# 以官方文件为底，把我们的 key 补回去
~/.bun/bin/bun -e '
const fs=require("fs");
const up=JSON.parse(fs.readFileSync("/root/merge/rc47/web/src/i18n/locales/zh.json","utf8"));
// 从 git 取我们上一个版本的对应文件
// 然后 Object.assign(up.translation, oursOnly)
'
```

### 6.4 回滚

```bash
# 最快：切回上一个镜像 tag
cd /www/dk_project/dk_app/newapi/newapi_hC8X
sed -i 's|image: new-api-lottery:rc47|image: new-api-lottery:rc46|' docker-compose.yml
docker compose up -d new-api

# 如果数据库迁移有问题，恢复备份
gunzip < /root/dbbackup/pre-rc47-*.sql.gz | \
  docker exec -i newapi_hc8x-mysql-1 mysql -uroot -p<密码> new-api
```

> **注意**：新版本可能已执行 `AutoMigrate` 添加了字段/表。回滚镜像后这些字段会留着，通常无害（GORM 只加不删），但要知道它们存在。

---

## 七、构建细节

### Dockerfile 关键点

```dockerfile
FROM oven/bun:1.4.0 ... AS builder      # 前端
FROM golang:1.26.10-alpine ... AS builder2  # 后端
COPY --from=builder /build/web/dist ./web/dist
RUN go build -pgo="..." -ldflags "-s -w -X '...common.Version=$(cat VERSION)'" -o new-api
```

- **`VERSION` 文件必须非空**，否则 `--version` 输出为空。当前内容：`1.0.0-rc.46`
- 前端通过 `//go:embed web/dist` 打进二进制，所以**改前端必须重新构建镜像**，不能只替换文件
- rc.46 起 `Dockerfile` 需要 `relaykit/go.mod`、`tokenkit/go.mod` 存在（本地子模块）

### 构建耗时

约 **6 分钟**（缓存命中时更快）。建议放后台跑：

```bash
docker build --network host -t new-api-lottery:rc47 . > /tmp/build.log 2>&1 &
```

### 磁盘

一次完整构建约需 5 GB。构建失败报 `no space left on device` 时：

```bash
docker builder prune -af
docker rmi $(docker images new-api-lottery -q | tail -n +3)
```

---

## 八、前端开发约定（官方要求，必须遵守）

- 用 `bun`，不用 npm/yarn
- 组件 props **不要解构**，直接 `props.xxx`
- 单文件超过约 200 行考虑拆分
- 禁止 2 层以上嵌套三元
- 测试放在模块的 `__tests__/` 目录
- 所有界面文案必须 i18n，7 个语言文件都要加
- 用 `toIntlLocale()` 转换后再传给 `Intl.*`
- 改完 TS 必须跑 `bun run typecheck`

后端约定：

- JSON 一律用 `common.Marshal` / `common.Unmarshal`，禁止直接 `encoding/json`
- 必须同时支持 SQLite / MySQL / PostgreSQL
- 不得删除或重命名 **new-api** / **QuantumNous** 相关标识

### 这台机器的特殊限制

- **`bun run lint` 会崩**（oxlint 在 `oxc_allocator` 里 SIGABRT），服务器也没装 `node`
- 所以本地验证只靠 `bun run typecheck` + `bunx vitest run`
- oxlint 崩溃会生成巨大的 core dump（`web/core.1` 曾达 1.2 GB），发现就删

---

## 九、部署后验证清单

```bash
B=http://127.0.0.1:3000

# 1. 容器健康
docker ps --filter name=newapi_hc8x-new-api-1 --format "{{.Status}}"
# 期望：Up ... (healthy)

# 2. 无 panic
docker logs newapi_hc8x-new-api-1 --since 5m 2>&1 | grep -ci "panic\|fatal"

# 3. 版本正确
docker run --rm --entrypoint /new-api new-api-lottery:<tag> --version

# 4. 页面
for p in / /canvas /lottery /welfare-chests /welfare-apis /service-status /keys; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' $B$p)"
done

# 5. 自定义 API（需要登录 token）
TOKEN=$(curl -s -X POST "$B/api/user/login" -H "Content-Type: application/json" \
  -d '{"username":"<管理员>","password":"<密码>"}' \
  | tr ',' '\n' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
AUTH="Authorization: Bearer $TOKEN"

curl -s "$B/api/user/lottery/status"          -H "$AUTH" | head -c 100
curl -s "$B/api/user/welfare-chests/status"   -H "$AUTH" | head -c 100
curl -s "$B/api/welfare-apis"                 -H "$AUTH" | head -c 100
curl -s "$B/api/service-status"               -H "$AUTH" | head -c 100
curl -s "$B/api/service-status/admin/settings" -H "$AUTH" | head -c 100

# 6. 生图链路（画布依赖）
KEY=$(curl -s -X POST "$B/api/token/<id>/key" -H "$AUTH" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
curl -s -X POST "$B/v1/images/generations" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"gpt-image-2","prompt":"test","n":1,"size":"1024x1024"}' \
  --max-time 200 | head -c 100

# 7. 公网
curl -s https://<your-domain>/api/status | grep -o '"version":"[^"]*"'
```

> 服务器**自身出网受限**，`curl https://<your-domain>` 会返回 `000`。这是正常的，**不是故障**——请从本地浏览器或本机验证公网。

---

## 十、故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 生图无反应，转圈很久 | 大图生成需 20–60 秒 | 正常，画布有遮罩提示 |
| `gpt-image-2.5-flare` 报 500 | 上游渠道问题 | 换模型，或修渠道配置 |
| 图生图 `connection reset by peer` | 上游偶发重置 | 重试，成功率约 2/3 |
| 图生图 524 | Cloudflare 超时 | 重试或换小图 |
| `no space left on device` | 磁盘满 | `docker builder prune -af` |
| `bun run lint` 崩溃 | oxlint 与本机不兼容 | 只用 typecheck + vitest |
| 登录报 `AUTH_SESSION_LIMIT` | 活跃会话达 50 上限（rc.46 已有机制） | 清理 `user_sessions` 表 |
| 页面 200 但无新功能 | 浏览器缓存旧 bundle | 强刷 Ctrl+Shift+R |
| 公网 curl 返回 000（服务器上） | 服务器出网受限 | 从本机验证 |

### 清理会话

```sql
-- 查看
select user_id, status, count(*) from user_sessions group by user_id, status;

-- 撤销历史 curl 测试会话
update user_sessions set status='revoked'
where user_id=<id> and status='active' and user_agent like 'curl/%';
```

---

## 十一、安全注意事项

1. **仓库必须 Private**。本文件含服务器 IP 和域名。
2. **本仓库不含任何密钥**。数据库密码在服务器 `docker-compose.yml`，渠道密钥在数据库 `channels` 表。
3. **画布不持久化 API 密钥**，这是有意的设计。
4. 升级后检查 CVE 公告。rc.46 修的是 **CVE-2026-111943**（证书校验）。
5. 建议给 GitHub 用 **PAT（细粒度、仅 contents 写权限）**，不要用账号密码。
6. 定期检查 `service_status_samples` 表大小，避免无限增长。

---

## 十二、当前已知状态

| 项目 | 状态 |
|---|---|
| 生产镜像 | `new-api-lottery:rc46` |
| 回滚镜像 | `new-api-lottery:rc45s` |
| 前端测试 | 2364 通过 / 1 失败（`intl-locale.test.ts`，因服务器无 node） |
| typecheck | 通过 |
| gofmt | 干净 |
| 数据库迁移 | 重启两次幂等，无 panic |
| 可用生图模型 | `gpt-image-2`、`gpt-image-2.5`、`gpt-image-2.5-sunburst`（`-flare` 上游 500） |

---

## 附：常用命令速查

```bash
# 进数据库
docker exec -it newapi_hc8x-mysql-1 mysql -uroot -p<密码> new-api

# 看实时日志
docker logs -f newapi_hc8x-new-api-1

# 重启
cd /www/dk_project/dk_app/newapi/newapi_hC8X && docker compose restart new-api

# 查配置
docker exec newapi_hc8x-mysql-1 mysql -uroot -p<密码> new-api \
  -e "select \`key\`, left(value,60) from options where \`key\` like 'lottery%';"

# 查渠道
docker exec newapi_hc8x-mysql-1 mysql -uroot -p<密码> new-api \
  -e "select id,name,base_url,status from channels;"

# 本地开发前端（需要服务器上跑）
cd /root/newapi-build/web && bun run dev
```
