# new-api 定制版 — 运维与升级手册

> 本文档描述本仓库相对官方 new-api 的**全部改动**、**升级流程**和**部署方式**。
>
> ⚠️ 本文件包含服务器地址等基础设施信息，**仓库必须保持 Private**。

---

## 一、这是什么

本仓库是 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的定制分支，在官方 **v1.0.0-rc.47** 基础上叠加了九个自有功能（含一套自建的极验验证接入）。

它不是随意拷贝改动的副本，而是把上游版本作为**独立基线**维护的：

```
master ──●  rc.45 官方基线
         │
ours ────●  rc.45 + 我们的自定义功能
         │
         │  theirs ──●  rc.46 官方（压缩导入，与本仓库无共同祖先）
         │            │
         │            ●  rc.47 官方
         │            │
         └──────●  c103906  以补丁方式应用 rc.46→rc.47 的 176 个文件改动
                 │
                 ●  85ce240  发布提交（rc.47 + 我们的功能，tag v1.0.0-rc.47-random）
```

**为什么不用 `git merge`**：rc.46 当初是以压缩导入方式进入本仓库的，`theirs` 分支与本仓库没有共同祖先，
`git merge` 会直接报 `refusing to merge unrelated histories`。所以升级 rc.47 时改用：

```bash
git diff --binary --output=/tmp/up.patch theirs v1.0.0-rc.47   # 生成上游增量
git apply --3way /tmp/up.patch                                  # 带三向合并地应用
```

好处不变：上游改了什么、我们改了什么，都由 git 自己算，不需要人工比对。只有 7 个 i18n locale
文件需要额外处理（见 6.3）。

| 分支 | 含义 | 谁维护 |
|---|---|---|
| `master` | 最初的上游基线（rc.45） | 冻结，不再使用 |
| `theirs` | **上游镜像**，永远等于最新官方版本 | 每次升级时更新 |
| `ours` | **我们的工作分支**，= 上游 + 九个自定义功能 | 日常提交都在这 |

当前状态：

| 项目 | 值 |
|---|---|
| 官方版本 | v1.0.0-rc.47 |
| 上游提交 | `e835b1b` upstream v1.0.0-rc.47 |
| 上手方式 | `git apply --3way`（rc.47 与本地重叠 9 个文件，仅 7 个 locale 冲突） |
| 合并提交 | `c103906` chore(upstream): 无损合并官方 v1.0.0-rc.47 |
| 发布提交 | `708744c` style(rewards): 用 if-else 替换嵌套三元表达式（tag `v1.0.0-rc.47-claimwindow`） |
| 发布后修正 | 无 |
| 文件数 | 2917 |
| 代码树哈希 | `5ebf0f4`（发布提交的 tree，线上镜像已核对一致） |
| Go 版本 | 1.26.10（rc.46 起强制，见 CVE-2026-111943） |
| 前端依赖 | rc.47 更新了 axios / i18next / react-i18next / input-otp，升级后必须重跑 `bun install` |

---

## 二、部署信息（快速参考）

| 项目 | 值 |
|---|---|
| 站点 | `<你的域名>`（部署时替换） |
| 服务器 | `<服务器地址>`（不写入仓库） |
| 构建目录 | `/root/newapi-build` |
| 合并仓库 | `/root/merge/work` |
| 编排文件 | `/www/dk_project/dk_app/newapi/newapi_hC8X/docker-compose.yml` |
| 容器 | `newapi_hc8x-new-api-1` / `newapi_hc8x-mysql-1` |
| 内部端口 | 3000 |
| 数据库 | MySQL 8.2，库名 `new-api` |
| 缓存 | Redis |
| 时区 | Asia/Shanghai |
| 镜像命名 | `new-api-lottery:<tag>` |

> **服务器地址、IP、域名不写入本仓库。** 需要时从你自己的部署笔记里查。

> 数据库密码、管理员密码、渠道密钥**不在本仓库中**，见服务器 `docker-compose.yml` 与后台。

---

## 三、自定义功能清单

九个功能全部是**原生集成**（不是 iframe 嵌入），复用官方组件、主题和 i18n。

> 这里是九个：公告中心、抽奖、福利宝箱、福利 API、渠道可用性、无限画布、我的奖励、极验验证，以及 3.8 的看板娘；
> 3.0 是对官方 `/keys` 页的改造，3.10 是对官方首页的改版，两者都不算独立功能。

### 3.0 API 密钥页 `/keys` 的改造

在官方页面上加了两块东西：

**（1）顶部「API 端点」卡片**。原来地址藏在「API 地址」按钮的弹层里，新用户第一眼看不到，
经常把 `https://<域名>` 和 `https://<域名>/v1` 搞混。现在直接把基础地址摊在列表上方，每个地址带复制按钮，
第一个标「推荐」。

**关键点：地址会自动降级。** `setting/system_setting/system_setting_old.go` 里
`ServerAddress` 的默认值是硬编码的 `http://localhost:3000`，站点没配过就一直是它。
对公网访客来说这是个**根本连不上的地址**。所以前端做了判断（`resolvePublicAddress`）：

| 配置的地址 | 页面所在域名 | 显示 |
|---|---|---|
| `https://api.example.com` | 任意 | 用配置的 |
| `http://localhost:3000` | `https://<你的域名>` | **换成当前域名** |
| `http://localhost:3000` | `http://localhost:3000` | 保留（本地开发） |

**（2）列表视觉**。沿用官方 `DataTablePage`，只把移动端卡片的间距、圆角和字号收紧，
桌面端加了斑马纹和禁用行的淡化。**没有重写表格**——分页、筛选、列显隐、批量操作全用官方实现。

> **想彻底修掉地址问题**：在后台把「服务器地址」配成真实域名，前端就不会再走降级分支。
> 降级只是兜底，不是替代配置。

### 3.1 幸运抽奖 `/lottery`

用户每日免费抽奖，可单抽或十连抽。

页面分四块：顶部「今日剩余免费次数 + 大进度条 + 余额/今日所得/已用次数」的信息条，
左侧老虎机转盘与操作按钮，右侧按权重实时算出的**中奖概率表**，下方今日排名与中奖公示。
概率表由权重现场归一化，管理员随便填权重（不必凑成 100）都能显示正确百分比。

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

每张宝箱卡都有「本周消费 / 解锁门槛」的进度条，没达标时直接写清还差多少，
已开出的奖励用绿色横幅显示；两档位用不同色调（小帅鸽蓝、黑大帅紫）区分。

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

### 3.5 公告中心 `/announcements`

平台公告的独立阅读页。数据完全复用官方已有的 `console_setting.announcements`（`/api/status` 下发），
**没有新增后端字段或数据表**，所以后台「内容管理 → 公告」编辑器照旧维护即可。

- **后端**：无（沿用 `setting/console_setting`）
- **前端**：`web/src/features/announcements/`（约 660 行）

| 文件 | 职责 |
|---|---|
| `components/announcements-page.tsx` | 页面：列表、搜索、级别筛选、未读计数、全部已读、空状态 |
| `components/announcement-list-item.tsx` | 单条公告：级别徽章、未读标记、相对时间、完整正文、附加信息 |
| `components/announcement-detail-dialog.tsx` | 详情弹窗（看板与公告页共用，原在看板里） |
| `lib/announcements.ts` | 已读键、倒序排序、关键词/级别过滤、未读统计 |
| `types.ts` | `AnnouncementItem`、`AnnouncementType`、`toAnnouncementType()` |

**为什么另开一页**：看板公告卡片只显示一行预览（`line-clamp-1`），通知铃铛把列表截到 20 条，
长维护公告没有地方完整读。这个页面直接铺全文，并和铃铛共享同一份已读状态（`notification-storage`）。

**已读键规则**：有 `id` 用 `id:<n>`，没有就用「发布时间 + 正文 + 附加信息 + 级别」的指纹哈希——
公告是管理员手写 JSON，`id` 是少数情况；没有指纹的话，改了正文仍然会被算作已读。

### 3.6 无限画布 `/canvas`
基于本站模型的 AI 绘图工作台，可拖拽、缩放、加便签、图生图。

- **后端**：无（纯前端，直接调 `/v1/images/*`）
- **前端**：`web/src/features/canvas/`（约 1900 行）

| 文件 | 职责 |
|---|---|
| `canvas-workspace.tsx` | 编排：请求、节点布局、快捷键 |
| `api.ts` | 调 `/v1/images/generations`、`/v1/images/edits`、`/api/pricing`、`/api/token/*` |
| `components/canvas-board.tsx` | 画布容器：平移、缩放、点阵背景、缩放控件、连接线装配 |
| `components/canvas-connectors.tsx` | 连接线图层（SVG，在节点之下） |
| `components/canvas-node-frame.tsx` | 节点通用外壳：定位、拖拽、选中、尺寸测量 |
| `components/canvas-image-node.tsx` | 图片节点 + 操作菜单（重生成/参考图/下载/删除） |
| `components/canvas-text-node.tsx` | 便签节点（双击编辑） |
| `components/canvas-prompt-panel.tsx` | 左侧面板：提示词、密钥、模型、尺寸、数量 |
| `hooks/use-canvas-board.ts` | 状态：节点、视口、增删改、500ms 防抖持久化 |
| `lib/board-storage.ts` | IndexedDB 存储（库 `newapi-canvas`，表 `boards`） |
| `lib/connectors.ts` | 连接线几何：锚点选择 + 贝塞尔曲线 |
| `types.ts` | `CanvasNode = CanvasImageNode \| CanvasTextNode` 联合类型 |

#### 溯源连接线（parentId）

每张图片可以记住自己「从哪来」，画布会在两者之间画一条虚线轨道：

- 节点上的 `parentId?: string` 指向来源节点，随 IndexedDB 一起持久化。
- 触发来源的场景有两个：**生成变体**（当前参考图就是父节点）和**重新生成**（原图就是父节点）。
- 新图会摆在父图**右侧**（间隔 `PARENT_GAP = 56`），多张按行向下堆叠。若父图已滚出可视区，则退回「居中摆放」，避免新图落在看不见的地方。
- 连接线在 `lib/connectors.ts` 里算：比较两者中心的横向/纵向距离，**谁近走谁的边**——横向连接走左右边中点，纵向连接走上下边中点，曲线用三次贝塞尔。
- 锚点依赖节点真实高度（图片宽高比不同，高度不同），由 `canvas-node-frame.tsx` 用 `ResizeObserver` 测出 `offsetWidth/offsetHeight` 上报给画布。**测量值不持久化**，每次渲染重建。
- 父节点被删除后，子节点的 `parentId` 变成悬空引用，连线自动消失，不报错。
- 选中连线任一端时，该连线会加深显示。

#### 踩过的坑：i18n key 冲突

画布进度遮罩原来用了 `t('Drawing...')`，而抽奖页也用同一个 key，中文译成了「抽奖中」——于是生成图片时显示「抽奖中...」。

i18n 的 key 是**英文原文**，一词多义就会撞车。画布现在只用 `Generating...`（仅画布使用，译作「生成中...」）。
`__tests__/board-progress-overlay.test.tsx` 是防止回退的回归测试。

> **新增文案时**：如果英文词有歧义（draw / generate / run / open / claim…），换个更具体的说法，别和别的功能共用 key。

### 3.7 极验人机验证（GeeTest V4）

给注册、登录、签到、找回密码、发送邮箱验证码这五处加极验 V4 验证码，**每项可单独开关**，
和官方自带的 Turnstile **可以并存**（两个都开时，两个都要过）。

#### 后台在哪配

`系统设置 → 安全 → 极验验证`（`/system-settings/security/geetest`）

| 配置项 | 含义 |
|---|---|
| `geetest_setting.enabled` | 总开关 |
| `geetest_setting.captcha_id` | 验证 ID（公开，会下发到浏览器） |
| `geetest_setting.captcha_key` | 验证密钥（只在服务端签名用，**绝不下发**） |
| `geetest_setting.on_register` | 注册时验证 |
| `geetest_setting.on_login` | 登录时验证 |
| `geetest_setting.on_checkin` | 签到时验证 |
| `geetest_setting.on_password_reset` | 找回密码时验证 |
| `geetest_setting.on_email_verify` | 发送邮箱验证码时验证 |

**填好 ID 和密钥之前，总开关是禁用的**——避免配了一半导致全站被锁死。
后端 `controller/option.go` 里也有一道同样的拦截，直接调 API 也绕不过去。

#### 接入方式（V4 协议）

1. 浏览器加载 `https://static.geetest.com/v4/gt4.js`，`initGeetest4({captchaId, product:'popup'})`。
2. 用户点击按钮弹出验证码，通过后 `getValidate()` 返回四个字段：
   `lot_number`、`captcha_output`、`pass_token`、`gen_time`。
3. 前端把这四个字段序列化成 **JSON 字符串**，放在 `?geetest=` 查询参数里（与 Turnstile 用 `?turnstile=` 同款做法，中间件顺序不变）。
4. 服务端 `service/geetest.go` 计算 `sign_token = HMAC-SHA256(lot_number, captcha_key)`（十六进制），
   连同四个字段 POST 到 `https://gcaptcha4.geetest.com/validate?captcha_id=<id>`，
   返回 `result === "success"` 才算通过。HTTP 超时 10 秒，GeeTest 挂了宁可让这一步失败也不拖住整站。

#### 关键点

- **票据是一次性的**：前端提交后立刻清空本地票据；请求失败用户必须重新验证。成功后的「已通过」状态显示为绿色条，带「重置」按钮。
- **密钥不出服务端**：`/api/status` 只返回 `geetest_captcha_id`，`captcha_key` 永远留在数据库和服务端内存里。
- **五种操作各返回一个布尔**：`geetest_register_check`、`geetest_login_check`、`geetest_checkin_check`、`geetest_password_reset_check`、`geetest_email_verify_check`，前端据此决定要不要显示验证码。
- **签到是点按钮先展开验证区**，验证通过后自动提交签到，不用再点一次。

#### 踩过的坑：验证码"点了没反应"（真正原因）

上线后反复出现「按钮在、点了没反应」，前后查了三轮才定位。**根因只有一条**：

**没有调用 `appendTo()`，极验的触发按钮根本不会被渲染出来。**

极验 V4 的控件结构是这样的——`initGeetest4` 建好实例后，必须调 `appendTo(容器)`
让 SDK 把那个 260×50 的「点击按钮开始验证」按钮插进你的容器里，
**用户点这个按钮才会弹拼图**。只调 `showCaptcha()` 而不 `appendTo`，
SDK 会建好整套 DOM 但一个像素都不显示，`showCaptcha()` 静默返回 `undefined`，
连网络请求都不发。表面上看就是「什么都没发生」。

三种产品的实测结果（同一 captcha_id，同一 origin）：

| `product` | `.geetest_captcha` | 内置触发按钮 | 结论 |
|---|---|---|---|
| `popup` | 1200×50 block | **260×50 可见** | ✅ 采用 |
| `float` | 1200×50 block | **260×50 可见** | ✅ 可用 |
| `bind` | 0×0 none | 不存在 | ❌ 不可用 |

选 `popup` 而不是 `float`，是因为拼图会以居中弹窗打开，而不是极验自己的悬浮面板。

#### 附带修掉的两个真实缺陷

1. **没传 init 层 `onError`**。`gt4.js` 源码：

   ```js
   if (typeof config.onError === 'function') { config.onError({...}) }
   else { throw new Error(errors[errorType]); }   // 未捕获异常
   ```

   资源加载失败就抛异常，**初始化回调永远不执行**，实例建不起来。
   修法：`onError` 必传，再加 15 秒看门狗兜住"既不成功也不报错"。

2. **签到把验证码放在模态 Dialog 里**。模态给 `<body>` 设 `pointer-events: none`，
   而极验的弹层挂在 `<body>` 上——看得见点不到。
   修法：签到改成在卡片里**内联展开**验证区，不进 Dialog。

#### 排查陷阱：无头浏览器是假阴性

**无头浏览器里极验的验证盒子永远不会显示，连官方 demo 都一样。**
实测在 `geetest.com` 官方 demo 上用真实鼠标点击它自己那个可见的 300×50 按钮，
点击后 `box_wrap` 依然是 `0x0 display:none`。

所以「弹层没出现」在无头下**不能作为判断依据**。但**触发按钮本身是能正常渲染的**，
这一点可以可靠验证——排查时应该看：

- `.geetest_holder` 有没有渲染出 260×50 的可见按钮（这是 `appendTo` 生效的标志）
- 点击后 `.geetest_box` 是否变成 `340×385 display:block`（拼图打开）
- `/load` JSONP、`gcaptcha4.js`、`css`、`i18n`、拼图图片是否都 200

#### 手机适配实测

`popup` 模式对手机是友好的，SDK 按 UA 自动切换：

| 环境 | `/load` 的 `client_type` | 拼图尺寸 | 位置 | 横向溢出 |
|---|---|---|---|---|
| iPhone UA / 390px | `h5` | 340×385 | `x=25` 居中 | 无 |
| 桌面 / 1280px | `web` | 340×385 | `x=470` 居中 | 无 |

#### 涉及文件

| 文件 | 职责 |
|---|---|
| `setting/system_setting/geetest_setting.go` | 配置结构 + `ShouldVerify(action)` 判定 |
| `service/geetest.go` | V4 服务端校验、HMAC 签名 |
| `middleware/geetest-check.go` | `GeeTestCheck(action)` 中间件 |
| `router/api-router.go` | 5 条路由挂上中间件 |
| `controller/misc.go` | `/api/status` 下发公开配置 |
| `controller/option.go` | 无密钥时禁止开总开关 |
| `web/src/components/geetest-captcha.tsx` | 极验组件（加载脚本、弹窗、通过态） |
| `web/src/features/auth/hooks/use-geetest.ts` | 各表单的票据状态 |
| `web/src/features/system-settings/general/geetest-settings-section.tsx` | 后台配置页 |

**设计决策（重要）**：

1. **API 密钥不落盘**。密钥按需通过 `POST /api/token/:id/key` 取一次，只存在内存 `useRef` 的 Map 里，页面关闭即消失。这修掉了原 `infinite-canvas` 把密钥写 localStorage 的问题。
2. **图片存 IndexedDB，不存 localStorage**。1024×1024 的 b64 图片约 0.8–1.3 MB，localStorage 5 MB 上限会瞬间爆掉。
3. **只做图**。只接了 `/v1/images/generations` 和 `/v1/images/edits`，没有视频/音频/渠道管理。

**已知限制**：

- 图片存在**浏览器本地**，换浏览器或清缓存就没了。要跨设备需要后端加表。
- 图生图走 `/v1/images/edits`，上游偶发 `connection reset by peer`，重试即可（见第十节）。

### 3.8 看板娘（站点吉祥物）

登录后控制台右下角（可改左下）会出现一只**会动的「泡泡」鲸鱼娘**。她待机时呼吸张望，
点她会做反应动作并冒气泡，还能**用鼠标拖着走、甩出去**——扔出去会弹、落地会压扁回弹。
每个控制台页面都有，由布局统一挂载，不需要各页面单独接入。

整套交互逻辑移植自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)
（**MIT 许可，可商用**），素材重新压缩后内置进镜像，不依赖任何外部站点。

#### 为什么这次能用了，上次不行

第一版是手绘内联 SVG（现在保留为兜底，见 `whale-figure.tsx`）。当时拒绝参考站的判断是成立的：
参考站用的 DeepSeek 鲸鱼娘 **Live2D 模型是 CC BY-NC-SA 4.0（禁止商用）**，且要额外拉三个 SDK。

dsh-pet 完全不同：代码与素材都是 **MIT**，允许商用，只需保留版权声明（已写进
`web/public/mascot/CREDITS.md`）。所以这次放的是**真视频动画**，表现力远好于 SVG。

#### 动画资产

106 个 640×360 VP9 透明视频（一段 1.8s 上下，24fps），覆盖待机、转头、移动、点击回应，
以及「小动作 / 玩耍 / 吃什么 / 时节 / 文字」五类共 91 个具体动作。

| 项目 | 数值 |
|---|---|
| 原始总体积 | 53 MB |
| 压缩后 | **12.8 MB**（106 个，平均 124 KB） |
| 首次加载 | 只有 1 个待机片段（约 40 KB） |
| 其余 105 个 | 点击或链式切换时才按需 `fetch`，走 `blob:` URL |

压缩参数（见 `scripts/compress-pet-assets.sh`）：

```bash
ffmpeg -c:v libvpx-vp9 -i in.webm \
  -c:v libvpx-vp9 -vf "scale=280:-2" -crf 40 -b:v 0 \
  -an -auto-alt-ref 0 -pix_fmt yuva420p out.webm
```

#### 关键坑：alpha 会静默丢失

dsh-pet 的视频带 `TAG:ALPHA_MODE=1`，透明信息存在 VP9 的 **BlockAdditional** 里。
ffmpeg 的**原生 vp9 解码器读不到**这段，`ffprobe` 会报成 `yuv420p`，
再编码出去就是一个**不透明黑底**的视频——体积、画质都正常，只有透明没了。

**必须把 `-c:v libvpx-vp9` 同时写在输入前面当解码器**，ffmpeg 才会报 `yuva420p` 并保住 alpha。

验证不能只看编码参数，要用**红底合成实测**：把视频铺在 `#ff0000` 上截图数红像素。
正确压缩的片段透出 83.2% 红底，压坏的片段 0%（全黑）。浏览器里最终也复测了：
角色像素 **82.6% 透明**。

#### 三种素材各管什么

| 素材 | 数量 | 位置 | 用途 |
|---|---|---|---|
| 动画片段 | 106 | `web/public/mascot/clips/` | 主角本体，全部动作 |
| 立绘头像 | 12 | `web/public/mascot/portraits/` | 气泡里的小头像，点击时随机换表情 |
| 兜底 SVG | 1 | `whale-figure.tsx` | 视频加载失败时 |

立绘用站内生图工具（`gpt-image-2`）生成，384×384、白底，一张约 175 KB。
**立绘和动画不是同一个形象**：动画是 dsh-pet 原角色，立绘是定制的「泡泡」。
两者只在气泡这种小尺寸同框，已确认可接受。

#### 文件名为什么是 clip-001

上游动画名是中文（`东张西望.webm`）。中文名在 Linux + `http.FileServer` 下能跑通，
但 **`go:embed` 直接编译失败**：

```
main.go:44:12: pattern web/dist: cannot embed file web/dist/mascot/clips/是啊，吃什么.webm: invalid name
```

而且仓库、Windows 检出、CDN 每一层对非 ASCII 路径的处理都要单独赌一次。
所以统一换成 `clip-001 … clip-106` 这种 ASCII 序号，中文名到序号的映射留在
`web/src/components/mascot/clip-files.ts`，代码和测试仍然用可读的中文名。
顺带解决了两件事：单测能直接断言「目录引用的每个名字都有对应文件」，且不再有 URL 编码问题。

#### 后台在哪配

`系统设置 → 安全 → 看板娘`（`/system-settings/security/mascot`）

| 配置项 | 含义 |
|---|---|
| `mascot_setting.enabled` | 总开关 |
| `mascot_setting.name` | 名字，进问候语和按钮的可访问名 |
| `mascot_setting.greeting` | 问候语；留空用内置的七语言默认句 |
| `mascot_setting.placement` | `bottom-right`（默认）/ `bottom-left` |
| `mascot_setting.show_on_auth_pages` | 是否也出现在登录/注册页，默认关 |
| `mascot_setting.size` | 宽度像素，限制在 96–220，越界后端拒绝 |

设置页预览放的是**真实待机视频**，改尺寸立刻看到实际角色大小。

#### 交互行为

- **待机**：随机在「原地待机 / 东张西望 / 走来走去 / 做个小动作」之间链式切换，不重复同一段。
- **点击**：随机播一个点击回应（开心跃动、害羞惊讶、傲娇生气、挠痒咯咯笑、元气挥手），
  同时开/关气泡并随机换一张立绘。
- **拖拽**：抓住就换成「被鼠标拖拽悬空」的挣扎动作，松手按甩动速度**真的抛出去**。
- **抛掷物理**：弹簧跟随、软限速、重力 1400、落地反弹 0.78、地面摩擦；
  撞到左右墙反弹，可以扔出屏幕顶部再从上方落回来。
- **压扁回弹**：落地冲击越大压得越狠，用 `--mascot-squash-x/y` 两个 CSS 变量驱动，
  体积守恒（压扁时同时变宽），带 easeOutBack 过冲。
- **只轻放不算抛**：`estimateReleaseVelocity` 对慢速松手返回 `null`，角色安静落回原位，
  不会以一个滑稽的速度弹出去。

#### 无障碍与体感

- 角色**是拖拽面**，所以不能同时是 `<button>`（长按拖拽也会触发 click）。
  可访问入口是一个覆盖在其上的透明按钮，键盘 Tab 可达，有 `aria-label` 和 `aria-expanded`。
- 气泡 `role="status"` + `aria-live="polite"`，不抢焦点；`Esc` 关闭。
- **只在第一次访问问候一次**（`localStorage.mascot_greeted = '1'`），之后要说话得点她。
- **可以彻底关掉**：悬停（或聚焦）出现「隐藏」，写 `localStorage.mascot_hidden = '1'`。
  这是访客侧开关，与后台总开关互不影响。
- **尊重 `prefers-reduced-motion`**：开启时**一帧视频都不加载**，角色静止，只保留气泡。
  系统设置切换时实时响应，不用刷新。
- 移动端缩到 `min(配置尺寸, 26vw)`，实测 390px 宽无横向滚动。

#### 涉及文件

| 文件 | 职责 |
|---|---|
| `setting/system_setting/mascot_setting.go` | 配置结构 + `NormalizeSize()` / `NormalizePlacement()` |
| `controller/misc.go` | `/api/status` 下发 `mascot_*`（全是公开值，无密钥） |
| `controller/option.go` | 尺寸越界直接拒绝写入 |
| `router/web-router.go` | 显式注册 `.webm → video/webm` |
| `web/src/components/mascot/catalog.ts` | 动画清单、五类分组、权重 |
| `web/src/components/mascot/clip-files.ts` | 中文名 → `clip-NNN` 映射（生成文件） |
| `web/src/components/mascot/pickers.ts` | 随机选段、镜像规避、链式推进 |
| `web/src/components/mascot/physics.ts` | 弹簧、抛掷速度估计、飞行积分、压扁曲线 |
| `web/src/components/mascot/use-mascot-player.ts` | 双 `<video>` 交叉淡入、懒加载、失败兜底 |
| `web/src/components/mascot/use-mascot-drag.ts` | 指针捕获、拖拽跟随、抛掷、落地压扁 |
| `web/src/components/mascot/portraits.ts` | 立绘清单与随机挑选 |
| `web/src/components/mascot/site-mascot.tsx` | 编排：播放器 + 拖拽 + 气泡 + 隐藏 |
| `web/src/components/mascot/whale-figure.tsx` | 兜底内联 SVG |
| `web/src/features/system-settings/general/mascot-settings-section.tsx` | 后台配置页 + 视频预览 |
| `web/public/mascot/clips/` | 106 个压缩动画 |
| `web/public/mascot/portraits/` | 12 张立绘 |
| `web/public/mascot/CREDITS.md` | dsh-pet 的 MIT 版权声明（**必须保留**） |
| `scripts/compress-pet-assets.sh` | 批量压缩脚本 |
| `scripts/generate-mascot-memes.py` | 批量生成立绘 |

#### 踩过的坑

- **alpha 静默丢失**：见上文，解码器必须显式指定 `libvpx-vp9`。
- **`go:embed` 拒绝非 ASCII 文件名**：整个镜像构建失败，所以改成序号文件名。
- **`.webm` 的 MIME 被基础镜像映射成 `audio/webm`**：浏览器会当音频处理，画面不显示。
  在 `router/web-router.go` 里用 `mime.AddExtensionType` 显式纠正。
- **拖拽面 + 按钮会双触发**：pointerup 和 click 各触发一次，气泡开了又关。
  用 `event.detail === 0` 区分键盘激活，指针路径交给拖拽 hook。
- **`--mascot-size` 必须是 `min(148px, 26vw)`**：写死像素手机上会盖住按钮，
  只写 `vw` 后台配的尺寸就失效。
- **动画 keyframes 必须放在 `@layer utilities` 里**（`web/src/styles/index.css`），
  放外面会被 Tailwind 层叠顺序压掉。
- **逐帧 React state 会掉帧**：拖拽位置直接写 `style.transform`，
  压扁直接写 CSS 变量，都不经过 render。

---

### 3.9 我的奖励 `/rewards`

管理员定向发放「奖励券」，用户在券面页领取到余额。管理页 `/rewards/admin`。

#### 用户侧 `/rewards`

顶部渐变汇总面板（待领取总额 + 份数徽标），下方每张券一张卡片（xl 三列）：

- 券面固定长宽比 `741/425`，正文与票根按 `76% : 24%` 分栏，中间是**打孔线 + 上下各一个 22px 撕口**。
- 四种配色 `aurora / citrus / sunrise / nocturne`，各带网点底纹、光效层与悬停高光。
- 金额 36px 独立成块；有效期前置时钟图标；未到期用主色按钮，已过期置灰。
- 未到领取开始时间的券显示「未开始」，按钮置灰并提示「{{date}} 起可领取」。
- 下方是领取记录表（金额右对齐），**只列已结算**（`status <> pending`），避免和上方待领取重复。

#### 领取流程

| 步骤 | 行为 |
|---|---|
| 点按钮 | 弹窗显示券面金额 |
| 确认领取 | `POST /api/user/rewards/:id/claim`，事务内 `lockForUpdate` 锁住该条记录 |
| 成功 | 弹窗显示「奖励已到账 / 金额 / 账户余额」，列表自动移除该券并刷新记录 |
| 重复领取 | 返回 `already_claimed`，不再加钱 |
| 未到开始时间 | 返回 `REWARD_NOT_STARTED`，券保持待领取 |
| 已撤回/已过期 | 分别返回 `REWARD_CANCELLED` / `REWARD_EXPIRED` |

**过期是惰性的**：没有定时任务，读取待领取列表时顺手把过期的置为 `expired`。

#### 领取窗口

发放时可以指定**领取开始时间**与**领取截止时间**（`claim_start_at` / `expires_at`，Unix 秒）：

| 取值 | 含义 |
|---|---|
| 开始时间为 0 | 发放后立即可领（默认） |
| 截止时间为 0 | 长期有效（默认） |
| 开始时间 ≥ 截止时间 | 直接拒绝，`REWARD_INVALID_CLAIM_WINDOW` |

未到开始时间就领取返回 `REWARD_NOT_STARTED`，券仍保持 `pending`，到点后可正常领取。
待领取接口同时返回全量（`count` / `total_quota`）与当下可领（`claimable_count` / `claimable_quota`），
页面顶部的「可领取」金额只算后者，避免把预约发放的额度算成已到手。

#### 三种额度计算方式

| 模式 | 含义 |
|---|---|
| `fixed` | 每人固定额度 |
| `percentage` | 按累计消费比例，带每人封顶 |
| `random` | **每人随机**，在 `random_min_quota` ~ `random_max_quota` 区间内抽取 |

`random` 的关键设计：**抽额发生在发放那一刻**，结果直接写进 `reward_grants.amount_quota`。
之后活动总额、明细、撤回金额全部以落库值为准，不会因重算而变化，事后可审计。

预览时用区间中值估算，并返回 `estimated: true`，前端据此把文案改成「总额约 …（随机额度在发放时抽取）」，
避免把估算值误当成实际发放总额。

#### 发放范围

`all`（全体）/ `active`（近 N 天有消费）/ `spend`（累计消费区间）/ `specific`（指定用户 id）。
单次最多 `maxRewardRecipients = 5000` 人，超限直接报 `REWARD_TOO_MANY`。

#### 撤回

只作废**还没领取**的部分（`pending → cancelled`），已到账的余额不动。

| 文件 | 说明 |
|---|---|
| `model/reward.go` | 用户侧查询、领取、惰性过期 |
| `model/reward_admin.go` | 发放范围解析、预览、发放、明细、撤回 |
| `controller/reward.go` | HTTP 层，错误码原样下发给前端 |
| `setting/operation_setting/reward_setting.go` | 总开关、额度上限、默认券面文案 |
| `web/src/features/rewards/` | 前端模块，2792 行 |
| `web/src/features/rewards/components/reward-ticket.tsx` | 券面组件（四种配色） |
| `web/src/features/rewards/components/reward-amount-fields.tsx` | 三种计算方式的表单分区 |
| `web/src/features/rewards/components/reward-window-fields.tsx` | 领取开始/截止时间表单分区 |
| `web/src/features/system-settings/general/reward-settings-section.tsx` | 后台配置页 |

后台位置：`系统设置 → 计费 → 我的奖励`。

| 配置项 | 含义 |
|---|---|
| `reward_setting.enabled` | 总开关（关闭后用户侧显示「功能未开启」） |
| `reward_setting.max_quota_limit` | 领取后的余额上限，0 表示不限 |
| `reward_setting.history_page_size` | 用户领取记录每页条数 |
| `reward_setting.default_copy` | 默认券面文案（JSON，发放时固化到活动上） |

> **配置是分键存的**（`reward_setting.enabled` 等），不要整块 JSON 写 `reward_setting`，
> 否则配置系统读不到子键，总开关会一直显示为关。

---

### 3.10 首页改版 `/`（对齐 ovo1.vip 版式）

首页按 `https://ovo1.vip/home` 的版式重做，**功能入口保留我们自己的**（抽奖、宝箱、福利 API、渠道可用性、画布、公告、奖励、极验、看板娘）。

页面顺序：

| 区块 | 内容 |
|---|---|
| 顶部公告条 | 深色条，三条提示轮播（5.2s 自动、悬停暂停）、圆点指示、左右箭头 |
| Hero | 双栏：左侧 eyebrow + 两行大标题（首行蓝色 `#5b8ff9`）+ 描述 + 三个按钮；右侧旋转星球画布 |
| 服务商跑马灯 | 20 个品牌芯片，两份相同轨道做无缝滚动，边缘渐隐，悬停暂停 |
| 能力卡片 | 6 张，编号 01–06，各带图标与跳转（接入锚点、密钥、用量、奖励、抽奖、可用性） |
| 本站增强 | 9 个自有功能入口（抽奖/宝箱/福利 API/可用性/画布/公告/奖励/极验/看板娘） |
| 开发者接入 | 接入地址 + 复制、协议芯片、三步骤、代码示例（OpenAI/Anthropic/Gemini × Python/cURL） |
| 对话台引导 | 输入框 + 跳转 `/playground` |
| 常见问题 | 5 条折叠问答 |
| 结尾 CTA | 登录/未登录两种按钮组合 |

**星球画布**（`components/planet-globe.tsx`）用 2D canvas 画，不引 WebGL 与第三方库：

- 几何在 `lib/globe-geometry.ts`：`projectGlobePoint()` 做经纬度→单位球投影（含自转与 23° 级倾角），
  `buildGlobeMeridians/Parallels()` 生成网格，`buildGlobeSpeckles()` 用固定种子 `20261027` 生成陆地点阵
  （`asin` 均匀采样，保证每次刷新形状一致、不闪烁）。
- 只描 `z > 0` 的前半球，配合大气光晕、球体径向渐变、终止线阴影、边缘高光、倾斜轨道虚线。
- DPR 上限 2；`IntersectionObserver` + `visibilitychange` 时暂停；`prefers-reduced-motion` 下只画静止一帧。
- 明暗两套调色板，跟随 `useTheme()` 实时切换（实测暗色下中心像素由 `221,229,245` 变为 `26,38,62`）。

**接入地址复用 `resolvePublicAddress`**（与 `/keys` 的 API 端点卡片同一套降级规则），
所以站点没配「服务器地址」时，公网访客看到的是当前域名而不是 `localhost:3000`：

```
实际渲染：https://<当前域名>/v1
```

**i18n**：新增文案 **86 条**（首页静态文案 36 + 卡片/功能/步骤/FAQ 44 + 动作 3 + 公告条 3），
7 个语言全部补齐，键序与上游排序规则一致（纯数字键在前 + `Intl.Collator('en')`），
每语言 7888 键。新增 `@keyframes marquee-left`（`web/src/styles/index.css`，放在 `@layer utilities` 内，
并在 `prefers-reduced-motion` 下关闭）。

**回归测试**（`web/src/features/home/__tests__/`，29 项）：

| 文件 | 覆盖 |
|---|---|
| `globe-geometry.test.ts` | 投影单位球约束、极点/背面、自转与倾角、网格数量、点阵确定性与前缀稳定 |
| `notice-carousel.test.tsx` | 首条渲染、前后翻页与环绕、圆点跳转与 `aria-current`、区域可访问名 |
| `faq.test.tsx` | 5 条问答折叠、展开、再次收起 |
| `integration.test.tsx` | 地址渲染、协议切换、Python/cURL 切换、复制按钮 |
| `own-features.test.tsx` | 9 个入口、路由跳转、无路由项不生成链接 |

**实测（生产环境，1440px / 390px）**：双栏 `532px 532px`，星球 `460×460`（移动端 `342×342`），
跑马灯轨道宽 4848px、两组，`scrollWidth == clientWidth`（无横向溢出），
6 张能力卡、9 个自有入口、5 条 FAQ、协议页签三枚均正常。

### 3.11 工单系统 `/tickets` + 独立工单后台 `/tickets-admin`

对标 `https://api.e6t.cn/tickets` 的工单系统，分两侧：

| 侧 | 路由 | 账号体系 |
|---|---|---|
| 用户侧 | `/tickets`（在 `_authenticated` 下） | 复用站点登录态 |
| 后台侧 | `/tickets-admin`（在站点布局之外） | **完全独立**：`ticket_agents` 表 + 自己的 Bearer 会话 |

#### 用户侧 `/tickets`

左侧工单列表（打开 / 已归档两个页签），右侧会话详情；空态直接给「新建工单」引导。

| 元素 | 说明 |
|---|---|
| 状态 | `pending` 待处理、`processing` 处理中、`awaiting_user` 待用户回复、`resolved` 已解决、`closed` 已关闭 |
| 展示标签 | `pending` 与 `processing` 对用户是同一件事，合并显示「待客服回复」 |
| 分类 | `api` 接口与技术问题、`billing` 充值与计费问题、`account` 账号问题、`model` 模型使用问题、`other` 其他问题 |
| 附件 | PNG / JPG / GIF / WebP，单张 ≤ 2 MB，单条消息最多 4 张 |
| 回复 | `Enter` 发送，`Shift + Enter` 换行 |
| 动作 | 新建工单、标记为已解决、归档、恢复 |
| 已结束 | `resolved` / `closed` 后输入框换成「该工单已关闭。如需继续帮助请新建工单。」 |

标题 ≤ 200 字、正文 ≤ 5000 字（按 rune 计），超限后端返回 `invalid_title` / `invalid_content`。
每个用户的未结工单数受 `ticket_setting.max_open_tickets` 限制（默认 5），超限返回 `too_many_open_tickets`。

#### 独立后台 `/tickets-admin`

页面在 `createFileRoute('/tickets-admin')`，**不在 `_authenticated` 下、不渲染侧边栏**，
有自己的登录卡片（含「第一次使用？创建所有者账号」引导）。

| 页面 | 内容 |
|---|---|
| 队列 | 关键词搜索（标题 / 用户名 / 消息内容）、状态筛选、分类筛选、指派筛选（全部 / 指派给我 / 未指派）、归档开关、分页；顶部四个计数徽标 |
| 详情 | 会话流、客服回复框（可带图）、指派下拉、状态下拉、归档 / 恢复 |
| 账号 | 后台账号列表（角色 / 权限 / 状态 / 最近登录）+ 新建 / 编辑 / 重置密码 / 删除 |
| 设置 | 启用工单系统、允许图片附件、客服在线、客服名称、欢迎语、离线自动回复、每用户未结工单上限 |

**权限模型**（`ticket_agents.permissions`，逗号分隔；`owner` 角色恒为全部权限）：

| 权限位 | 作用 |
|---|---|
| `tickets.view_all` | 看全部工单；没有时只能看指派给自己的 |
| `tickets.reply` | 回复工单 |
| `tickets.assign` | 指派工单给别人 |
| `tickets.close` | 改状态、归档、恢复 |
| `agents.manage` | 管理后台账号 |
| `settings.manage` | 修改工单设置 |

角色只影响默认权限勾选，实际鉴权只看权限位，因此可以给一个 `agent` 角色勾上 `settings.manage`。

**管理员直通**：站点管理员（`role >= ADMIN`）可以用站点会话直接进后台，
此时合成一个 `Id = 0` 的 owner 身份，不写 `ticket_agents` 表。
所以后台代码里凡是要落库归属的地方都得判 `if agent.Id > 0`。

**会话安全**：密码走 `common.Password2Hash`（bcrypt）；登录失败 5 次锁 15 分钟；
令牌是 32 字节随机数的 sha256，只存哈希，`Bearer` 头传递，登出即删行；
改密码后旧令牌立即失效（`RevokeTicketAgentSessions`）。

#### 附件存储

图片字节落磁盘（`TICKET_ATTACHMENT_DIR`，容器内 `/data/ticket-attachments`），
数据库只存 `storage_key`。原因：MySQL `TEXT` 只有 64KB，改成 `LONGBLOB` 又要三库分别处理。

未绑定消息的上传记录 `ticket_id = 0`，建消息时才绑定，绑定时校验
`uploader_type + uploader_id`，因此站点用户 #1 读不到客服 #1 上传的图。
`uploader_type` 取 `user` / `agent`，读图接口也按这两侧分别鉴权。

#### 设置项

`ticket_setting` 作为一个整体注册到 `setting/operation_setting`，
改设置时用 `config.ConfigToMap` 取出 `ticket_setting.*` 前缀的键，再 `model.UpdateOptionsBulk` 批量写回，
**不要**整体覆写 `options` 表。

#### 实测

| 层面 | 结果 |
|---|---|
| 模型层 | `ticket-flow.go` 32 项全通过（建单 / 读隔离 / 回复 / 权限 / 指派 / 可见范围 / 计数 / 解决 / 归档 / 附件归属 / 未结上限） |
| HTTP 层 | `http-check.go` 20 项全通过（真实 MySQL + 真实容器） |
| 后台 HTTP | `console-check.go` 29 项全通过（登录 / 权限 / 队列 / 详情 / 传图读图 / 回复 / 指派 / 解决 / 归档 / 恢复 / 客服建单 / 用户搜索 / 管理员直通 / 设置开关 / 登出失效） |
| 用户侧 UI | CDP 实测：登录 → 新建工单（含分类、正文）→ 回复 → 标记已解决 → 归档 → 归档页恢复，全部走通 |
| 后台 UI | CDP 实测：`owner` 登录 → 队列 2 条（含计数徽标）→ 详情 → 回复（状态自动转「待你回复」）→ 状态改已解决 → 账号页 → 设置页，控制台零报错 |
| 三库迁移 | SQLite / MySQL 8.2 / PostgreSQL 16 各跑两次 `AutoMigrate`，表与列断言通过，幂等 |

#### 这次踩到的两个真 bug（已修）

1. **队列永远 0 条**：前端筛选下拉的「全部」传的是字面量 `all`，后端把 `category` 当真实分类去查
   `category = 'all'`，自然查不到。修法：`model.TicketFilterAll` 常量，`category == all` 时跳过该条件。
2. **关键词搜用户名无效**：子查询写成了 `id IN (SELECT id FROM users WHERE username LIKE ?)`，
   拿工单 id 去比用户 id。修法：改成 `user_id IN (...)`。

> 同类隐患：`status=all` 之所以没出问题，是因为 `NormalizeTicketStatus` 对未知值返回空串，
> 顺手也把 `category` 改成同一套「未知即不过滤」的语义，避免以后再踩。

#### tickets6 修的两个 bug（已修）

1. **工单图片一律显示「图片不可用」**：`use-ticket-image.ts` 用裸 `fetch(..., { credentials: 'include' })`
   去读图，但本站鉴权走 `Authorization: Bearer <accessToken>`（令牌在 zustand store 里，不是 Cookie），
   所以请求必然 401；后台侧还更严重——它复用了用户侧组件，打的是 `/api/user/ticket-uploads/:id`。
   修法：`useTicketImage(id, load)` 接收注入的加载器，用户侧传 `ticketImageBlob`（走共享 `api` 实例，
   自动带令牌与刷新），后台侧传 `consoleImageBlob`（走 `consoleApi` + 本地后台令牌），
   取回 blob 再 `URL.createObjectURL`；非 `image/*` 的响应体直接判为失败，避免把 JSON 错误页当图渲染。
2. **后台归档后用户端不归档**：后端本来就是同一列 `tickets.archived`（实测后台归档后
   用户 `archived=false` 列表为 0、`archived=true` 为 1），问题在前端——用户页的查询
   `staleTime` 到期也不会自动重取，而 `query-client.ts` 全局关了 `refetchOnWindowFocus`，
   页面一直挂着就永远看不到归档结果。修法：用户侧列表与详情加 `refetchInterval: 20s` +
   `refetchOnWindowFocus`；同时把 `replyable` 改为 `!archived && !IsTicketEnded(status)`，
   让已归档工单在两侧都直接禁用输入框（后台 `ReplyStaffTicket` 也补了 archived 拦截）。

回归用例：`model/ticket_archive_test.go`（4 项）、`web/src/features/tickets/__tests__/attachments.test.tsx`（4 项）、
`archive.test.tsx`（3 项）。

### 3.12 中转链路性能优化（异步日志 + 批量落库）

目标：让用户连上来更快、每次调用更快。瓶颈不在 CPU（8 核只用了 1 核），而在**每个请求都要同步提交多次
MySQL 事务**，其中消费日志一次 INSERT 就占 3.3 ms，而小响应体在 handler 返回前一直压在 net/http 的
2 KB 缓冲区里，所以这笔开销直接变成用户看到的延迟。

#### 代码改动

1. **消费日志改为异步批量落库**（`model/log_queue.go` 新增，`model/log.go`、`main.go` 改）
   - `RecordConsumeLog` 只把行放进队列（上限 4096 行）并唤醒刷盘协程，不再等 INSERT；
   - 刷盘协程每次取走队列里已经堆积的行，最多 128 行一条 `CreateInBatches`，高并发下几十上百行共用一次提交；
   - 队列满（DB 明显跟不上）时**回退为调用方同步写入**，不丢行；
   - 每行记住自己创建时的 `LOG_DB`，测试里换库不会串到旧的连接上；
   - 关库前 `model.FlushLogQueue()` 把内存里的行写完（`main.go` 的优雅退出流程里调用）。
2. **`record consume log` 的明细日志改为仅 DEBUG 输出**：原来每个请求都要
   `common.GetJsonString(params)` 序列化一次 params 再走必然输出的 INFO，纯浪费。

> 语义影响：消费流水的额度扣减（Redis / 配额表）仍在同步路径上，日志只是审计副本，
> 最坏情况是管理员日志页晚几十毫秒看到那一行；进程被 kill -9 会丢掉队列里最后不到 4096 行。

#### 部署侧改动（`docker-compose.yml`，不在代码里）

| 项 | 值 | 原因 |
| --- | --- | --- |
| `BATCH_UPDATE_ENABLED` | `true` | 关掉每个请求 2 次的同步 `UPDATE`（用户已用额度、渠道已用额度），改成 3 秒批量刷（`BATCH_UPDATE_INTERVAL=3`）。Redis 开着时额度以 Redis 为准，DB 只是镜像，滞后几秒可接受 |
| `SQL_MAX_OPEN_CONNS` / `SQL_MAX_IDLE_CONNS` | `100` / `25` | 默认 `1000` 远超 MySQL `max_connections=151`，压测时直接 `Error 1040: Too many connections` |
| MySQL `--max-connections=500` | 500 | 与上面的池子匹配 |
| MySQL `--innodb-flush-log-at-trx-commit=2 --sync-binlog=0` | 2 / 0 | 每次提交不再等 fsync，单请求写入延迟从 ~1.5 ms 降到 ~0.2 ms。代价：**操作系统崩溃/断电最多丢 1 秒已提交事务**（MySQL 进程崩溃不丢）。要最保守可改回 1 / 1 |

#### 实测（本机 8 核，上游为同机 stub，`/v1/chat/completions`）

| 场景 | 优化前 | 优化后 |
| --- | --- | --- |
| 单并发 p50 | 16.5 ms | **2.6 ms** |
| c=16 吞吐 | 119 rps | **1435 rps** |
| c=64 吞吐 / p50 | 134 rps / 489 ms | **1300 rps / 42 ms** |
| c=128 吞吐 | —（大量 1040 失败） | 1356 rps，0 失败 |
| 走 HTTPS（nginx）c=1 / c=16 / c=64 | — | 3.1 ms / 917 rps / 533 rps |

一致性核对：同一轮压测发出 11500 次调用，`logs` 表新增 11502 行（另外 2 行为后台操作），异步队列没有丢行。

#### 渠道超时与重试

渠道 `api.x5m5x.com`（唯一的图片渠道）在上游处理超过约 30 秒时会直接 reset TCP 连接，
而 `gpt-image-2` / `images/edits` 经常跑到 30 秒以上，于是表现为间歇性
`500 do request failed: read: connection reset by peer`。这不是本站问题：
直连该域名用 curl 打同一个模型同样会被 reset，换 `gpt-image-2.5` 则正常。

应对：把运维设置里的 `RetryTimes` 从 `0` 调到 `1`（选项表 `RetryTimes=1`），
网络错误（`IsChannelError`）会走一次自动重试，实测三次连打 `gpt-image-2` 全部成功
（其中一次耗时 64 秒，即第一次被 reset、第二次成功）。nginx 侧 `proxy_read_timeout` 为 600s，
不会截断重试。


---

## 四、代码结构：哪些是我们的

### 新增文件（纯新增，升级不会冲突）

**后端**

```
controller/lottery.go                              75
controller/welfare_api.go                          96
controller/welfare_chest.go                        67
controller/service_status.go                      378
controller/reward.go                              131
model/lottery.go                                  498
model/welfare_chest.go                            398
model/service_status.go                           350
model/reward.go                                   334
model/reward_admin.go                             614
model/reward_test.go                              305
service/service_status_probe.go                   320
setting/operation_setting/lottery_setting.go       74
setting/operation_setting/welfare_api_setting.go   51
setting/operation_setting/welfare_chest_setting.go 84
setting/operation_setting/service_status_setting.go 207
setting/operation_setting/reward_setting.go        86
setting/system_setting/geetest_setting.go          87
controller/ticket.go                              276
controller/ticket_admin.go                        ~600
model/ticket.go                                   ~560
model/ticket_admin.go                             ~480
model/ticket_agent.go                             ~560
model/ticket_attachment.go                        217
middleware/ticket-agent-auth.go                   123
setting/operation_setting/ticket_setting.go        ~90
```

**前端**

```
web/src/features/announcements/           ~660 行
web/src/features/canvas/                  ~1900 行
web/src/features/lucky-bonus/             ~1900 行
web/src/features/rewards/                 ~2792 行
web/src/features/service-status/          ~985 行
web/src/features/welfare-api/             ~540 行
web/src/features/tickets/                 ~1500 行
web/src/features/ticket-console/          ~2100 行
web/src/features/system-settings/general/lottery-settings-section.tsx
web/src/features/system-settings/general/welfare-api-settings-section.tsx
web/src/features/system-settings/general/welfare-api-entry-dialog.tsx
web/src/features/system-settings/general/welfare-chest-settings-section.tsx
web/src/features/system-settings/general/service-status-settings-section.tsx
web/src/features/system-settings/general/service-status-target-dialog.tsx
web/src/features/system-settings/general/service-status-target-row.tsx
web/src/features/system-settings/general/geetest-settings-section.tsx
web/src/features/system-settings/general/reward-settings-section.tsx
web/src/components/geetest-captcha.tsx
service/geetest.go
middleware/geetest-check.go
web/src/routes/_authenticated/announcements/index.tsx
web/src/routes/_authenticated/canvas/index.tsx
web/src/routes/_authenticated/lottery/index.tsx
web/src/routes/_authenticated/rewards/index.tsx
web/src/routes/_authenticated/rewards/admin.tsx
web/src/routes/_authenticated/welfare-chests/index.tsx
web/src/routes/service-status/index.tsx
web/src/routes/welfare-apis/index.tsx
web/src/routes/tickets-admin.tsx
web/src/routes/_authenticated/tickets/index.tsx
web/public/static/welfare-chests/        （图片资源）
```

### 修改的官方文件（升级时唯一可能冲突的地方）

一共 **24 个**，每处改动都很小、很集中：

| 文件 | 改动内容 |
|---|---|
| `main.go` | 启动探测 worker（3 行） |
| `model/main.go` | AutoMigrate 注册 6 张新表（6 行）；工单再加 5 张（`tickets` / `ticket_messages` / `ticket_attachments` / `ticket_agents` / `ticket_agent_sessions`） |
| `router/api-router.go` | 注册抽奖/宝箱/福利API/可用性/奖励路由（约 24 行）；5 条鉴权路由挂 `GeeTestCheck`；用户侧工单路由在 `selfRoute` 下，后台工单路由独立 `/ticket-console` 分组 |
| `router/web-router.go` | `WebAssets` 结构体挪到文件末尾（纯格式） |
| `controller/option.go` | 配置变更后触发探测（4 行）；无密钥时禁止开极验总开关 |
| `controller/misc.go` | `/api/status` 下发极验公开配置（7 行）；下发 `rewards_enabled`、`tickets_enabled` |
| `web/src/hooks/use-sidebar-data.ts` | 侧边栏 10 个菜单项（含公告、我的奖励、我的工单） |
| `web/src/hooks/use-sidebar-config.ts` | 侧边栏模块开关默认值（含公告、我的奖励、工单） |
| `web/src/lib/nav-modules.ts` | 顶部导航模块 `welfareApi`、`serviceStatus` |
| `web/src/features/system-settings/types.ts` | 新增配置项的 TS 类型（含 `reward_setting.*`） |
| `web/src/features/system-settings/security/*` | 注册「极验验证」设置页（`index.tsx` + `section-registry.tsx`） |
| `web/src/features/system-settings/billing/*` | 注册「我的奖励」设置页（`index.tsx` + `section-registry.tsx`） |
| `web/src/features/system-settings/maintenance/config.ts` | 侧边栏模块清单新增「我的奖励」 |
| `web/src/features/system-settings/maintenance/sidebar-modules-section.tsx` | 后台侧边栏模块新增「公告」「我的奖励」开关说明 |
| `web/src/features/profile/components/sidebar-modules-card.tsx` | 用户个人设置里的侧边栏模块新增「公告」「我的奖励」 |
| `web/src/features/auth/types.ts` | 状态接口补 `rewards_enabled` |
| `web/src/features/dashboard/components/overview/announcements-panel.tsx` | 公告卡片改为复用公告模块的详情弹窗，右上角加「查看全部」 |
| `web/src/features/dashboard/components/ui/panel-wrapper.tsx` | 空状态下也渲染 `headerActions`（否则「查看全部」在无公告时消失） |
| `web/src/features/auth/*` | 登录/注册/找回密码/邮箱验证码四处接入极验 |
| `web/src/features/home/*` | 首页按 ovo1 版式重做（新增 9 个组件 + 几何库，删除旧 Hero 终端演示等 13 个文件） |
| `web/src/features/home/components/sections/own-features.tsx` | 自有入口加「工单」一项（9 → 10 个） |
| `web/src/styles/index.css` | 新增 `@keyframes marquee-left` 与服务商跑马灯类 |
| `web/src/routeTree.gen.ts` | 路由树（构建时自动生成） |
| `web/src/i18n/locales/*.json` × 7 | 自定义文案，rc.48 合并后每语言 8014 键 |

> 原本的 `web/src/features/dashboard/components/overview/announcement-detail-dialog.tsx`（82 行）已**删除**，
> 弹窗迁到 `web/src/features/announcements/components/announcement-detail-dialog.tsx` 由看板与公告页共用。

> `web/src/routeTree.gen.ts` 是 TanStack Router 构建时自动生成的，**不要手工改**，冲突时直接接受上游版本再跑一次 `bun run build` 即可重新生成。
> 仓库里的 `routeTree.gen.ts` 若缺少某个新路由，`bun run typecheck` 会报 `createFileRoute` 的参数不匹配——
> 可以用 `@tanstack/router-generator` 的 `Generator` 类单独跑一次生成，不必整包构建。

---

## 五、数据库

### 自定义表（6 张）

| 表 | 用途 |
|---|---|
| `lottery_draws` | 抽奖记录 |
| `lottery_rounds` | 奖池轮次 |
| `welfare_chest_claims` | 宝箱领取记录 |
| `service_status_samples` | 可用性探测样本 |
| `reward_campaigns` | 奖励活动（含 `random_min_quota` / `random_max_quota`） |
| `reward_grants` | 逐人发放明细，唯一键 `(campaign_id, user_id)` |

全部通过 `model/main.go` 的 `AutoMigrate` 自动建表，**无需手工执行 SQL**。

### 自定义配置项

存在 `options` 表，前缀区分：

```
lottery_setting.*
welfare_chest_setting.*
welfare_api_setting.*
service_status_setting.*
geetest_setting.*
reward_setting.*
```

`service_status_samples` 会持续增长，按 `sample_retention_days` 清理（默认 30 天）。

> `geetest_setting.*` 里的 `captcha_key` 是**明文存在数据库**的（和其他密钥如 SMTP 密码、渠道 key 一样），
> 备份文件等同敏感文件，注意保管。它不会出现在 `/api/status` 返回里。

### 备份

```bash
docker exec newapi_hc8x-mysql-1 mysqldump -uroot -p<密码> \
  --single-transaction --quick new-api | gzip > backup-$(date +%F).sql.gz
```

**升级前必须备份。** rc.46→rc.47 升级前的备份在 `/root/dbbackup/`。

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

# ── 3. 把上游增量应用到我们的分支 ─────────────
# ⚠️ 不要用 git merge theirs：rc.46 是压缩导入的，与本仓库无共同祖先，
#    merge 会直接报 "refusing to merge unrelated histories"。
git checkout ours
git diff --binary --output=/tmp/up.patch theirs v1.0.0-rc.47
git apply --3way /tmp/up.patch
# 若报冲突：git diff --name-only --diff-filter=U  →  解决后 git add <file>
git add -A && git commit -m "chore(upstream): 无损合并官方 v1.0.0-rc.47"

# ⚠️ 生成补丁必须用 git 的 --output=，不要用 shell 的 > 重定向：
#    PowerShell 会把输出转成 UTF-16，git apply 会报 "No valid patches in input"。

# ── 4. 同步到构建目录 ────────────────────────
cd /root/newapi-build
rsync -a --delete \
  --exclude 'web/node_modules' \
  --exclude 'web/dist' \
  --exclude '.git' \
  /root/merge/work/ ./

# ── 5. 更新版本号 ────────────────────────────
cat VERSION                 # 必须与仓库一致；构建目录残留旧版本会打进二进制
echo "1.0.0-rc.47" > VERSION

# ⚠️ 只同步 web/src 不同步 VERSION，二进制会继续报旧版本号
#    （rc.47 首页上线后曾出现：镜像里的 /new-api --version 仍是 1.0.0-rc.46，
#     因为构建目录只覆盖了 web/，VERSION 还是更早一次构建留下的 rc.46）。
#    构建前先确认：cat /root/newapi-build/VERSION 与 git show HEAD:VERSION 相同。

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

冲突几乎只会出现在第四节列的那 22 个文件里。判断方法：

```bash
# 看上游在这个文件改了什么
git log --oneline theirs -- router/api-router.go
git diff master theirs -- router/api-router.go

# 看我们改了什么
git diff master ours -- router/api-router.go
```

**处理原则**：以**上游的新结构**为骨架，把我们的改动**重新插进去**。我们的改动都是"在某个位置加几行"，重新插入很直接。

最常见的冲突是 `router/api-router.go`（上游常改路由）和 `web/src/i18n/locales/*.json`（上游常加文案）。

#### i18n 冲突的处理（rc.47 实测流程）

上游对 locale 文件**只做两件事**：重排序 + 新增键，**从不修改既有译文**。所以能机械处理：

```bash
# 1. 以上游 rc47 的文件为底（保留它的全部新键与新译文）
# 2. 把本地独有键补回去（本地键 = 本地旧文件 - 上游旧文件）
# 3. 按上游的排序规则重排
~/.bun/bin/bun /root/merge/merge-locales.js
```

**上游的键排序规则**（`merge-locales.js` 已实现，rc47 `zh.json` 7359 键逐键核对通过）：

1. **纯数字键**排在最前，按数值升序（`"1"`、`"2"`…`"10"`，不是字典序）；
2. 其余键按 `new Intl.Collator('en').compare` 升序。

> 排序不对不影响功能（JSON 无序），但会让每次升级都产生几千行无意义的 diff，
> 掩盖真正的改动。所以务必重排。

> `bun run i18n:sync` 会把 footer 的键改写成 `footer.new\u0061pi.projectAttributionSuffix`，
> 跑完要还原：`sed -i 's/footer\.new\\u0061pi\./footer.newapi./g'` 全部 7 个 locale 文件。
> 这是工具的历史遗留问题，与合并无关。

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

- **`VERSION` 文件必须非空**，否则 `--version` 输出为空。当前内容：`1.0.0-rc.47`
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
curl -s https://<你的域名>/api/status | grep -o '"version":"[^"]*"'

# 8. 极验字段是否下发（7 个，值为 false 属正常——总开关默认关）
curl -s $B/api/status | tr ',' '\n' | grep geetest
```

### 极验功能的验证方法

打开极验后（后台填好 ID + 密钥 → 开总开关），用 curl 直接打接口验证中间件真的在拦：

```bash
# A. 不带 geetest 参数 → 应返回 "Complete the human verification first"
curl -s -X POST "$B/api/user/login" -H "Content-Type: application/json" \
  -d '{"username":"<用户>","password":"<密码>"}'

# B. geetest 参数不是 JSON → 应返回 "The human verification result could not be read"
curl -s -X POST "$B/api/user/login?geetest=notjson" \
  -H "Content-Type: application/json" -d '{"username":"<用户>","password":"<密码>"}'

# C. 票据格式对但伪造 → 上游拒绝，应返回 "Human verification failed, please try again"
curl -s -G -X POST "$B/api/user/login" \
  --data-urlencode 'geetest={"lot_number":"abc","captcha_output":"x","pass_token":"y","gen_time":"1700000000"}' \
  -H "Content-Type: application/json" -d '{"username":"<用户>","password":"<密码>"}'

# D. 把对应保护关掉后，同样的请求应该正常通过
```

> 服务器**自身出网受限**，`curl https://<你的域名>` 会返回 `000`。这是正常的，**不是故障**——请从本地浏览器或本机验证公网。

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

## 十二、版本发布规范

**每次上线都按版本发布资源包**，不要只推代码。版本号与上游对齐，后缀加构建标记。

### 版本号规则

```
v<上游版本>-<构建标记>
例：v1.0.0-rc.46-gt6
```

- 上游版本 = `1.0.0-rc.46`（来自 `common/version`）
- 构建标记 = 本次改动的短名（`gt6`、`canvas1` 等），同时也是 Docker 镜像 tag
- **不要用 `custom-` 之类的前缀**，CI 只认 `v*` 开头的 tag

### 发布步骤

1. 改完代码，`git commit` 并推送 `ours` / `main`
2. 打标签并推送：

   ```bash
   git tag -a v1.0.0-rc.46-gt6 -m "Release v1.0.0-rc.46-gt6"
   git push origin v1.0.0-rc.46-gt6
   ```

3. **推送标签会自动触发 GitHub Actions**，构建 macOS / Windows 桌面端并创建 Release（草稿态）
4. 导出 Docker 镜像并上传到同一个 Release：

   ```bash
   docker save new-api-lottery:gt6 | gzip -1 > new-api-lottery-gt6.tar.gz
   ```

   用 `POST /repos/<owner>/<repo>/releases/<id>/assets?name=<文件名>` 上传
5. 补写 Release 说明（变更、部署命令、SHA256），把 `draft` 改为 `false` 发布

### Release 里应包含的资源

| 文件 | 来源 |
|---|---|
| `new-api-lottery-<标记>.tar.gz` | 手工上传的 Docker 镜像 |
| `new-api-macos-<版本>` | CI 自动构建 |
| `new-api-<版本>.exe` | CI 自动构建 |
| `checksums-*.txt` | CI 自动生成 |

> 镜像 `docker save` 后约 84MB（gzip -1），GitHub 单文件上限 2GB，够用。
> 仓库本身只存源码（8MB），**不要把二进制提交进 git**——历史无法删除，会让克隆越来越慢。

### 大文件传输注意事项

服务器到本机 `scp` 大文件容易断（实测 84MB 传到 23MB 就 reset）。稳妥做法是**分块**：

```bash
split -b 15M -d image.tar.gz part.
# 逐块 scp，每块单独重试
cat part.* > image.tar.gz   # 本机合并后校验 MD5
```

---

## 十三、当前已知状态

| 项目 | 状态 |
|---|---|
| 生产镜像 | `new-api-lottery:tickets6`（`/new-api --version` = `1.0.0-rc.48`） |
| 官方基线 | `v1.0.0-rc.47`（`e835b1b`），代码树哈希 `f2fa906` |
| 首页 | **已改版并上线**：ovo1 版式 + 旋转星球 + 10 个自有入口（见 3.10） |
| 工单系统 | **已上线**：用户侧 `/tickets` + 独立后台 `/tickets-admin`（见 3.11）；`tickets6` 修复工单图片与归档同步 |
| 已发布版本 | `v1.0.0-rc.48-tickets`（含 Docker 镜像 tar.gz 与四平台二进制）、`v1.0.0-rc.48-tickets-fix` |
| 回滚镜像 | `new-api-lottery:tickets5`、`:tickets4`、`:tickets3`、`:home5`、`:home4`（其余历史镜像已清理腾出磁盘） |
| 磁盘占用 | 需定期 `docker image prune` 回收 |
| 前端测试 | 工单新增 **17 项**（`status.test.ts` 6 + `permissions.test.ts` 4 + `attachments.test.tsx` 4 + `archive.test.tsx` 3）；侧边栏/首页测试随入口数量同步更新 |
| typecheck | 通过（1556 文件，2 个项目） |
| oxlint | 工单相关文件 0 warning / 0 error |
| gofmt | 干净 |
| go vet | `./controller/ ./model/ ./middleware/ ./router/ ./setting/...` 全通过 |
| Go 单测 | `./model/` 全 `ok`（含 `ticket_archive_test.go` 4 项归档回归） |
| 数据库迁移 | SQLite / MySQL 8.2 / PostgreSQL 16 三库各跑两次 `AutoMigrate`，含 5 张工单表，幂等且旧数据完好 |
| 极验 | **已上线并开启**（登录 + 注册）；验证 ID 已填入 |
| 看板娘 | **已上线并默认开启**，106 个动画 + 12 张立绘全部内置 |
| 看板娘体积 | 动画 12.8MB（原 53MB）+ 立绘 2.1MB；首屏只加载 1 个待机片段 |
| 我的奖励 | **已上线** `/rewards` + `/rewards/admin`；支持固定/比例/随机三种额度 |
| API 端点卡片 | **已上线**；`server_address` 仍是默认的 `localhost:3000`，前端已降级为当前域名 |
| 可用生图模型 | `gpt-image-2`、`gpt-image-2.5`、`gpt-image-2.5-sunburst`（`-flare` 上游 500） |
| 画布存储 | **已修复丢图**：布局/图片分库、图片即时落盘、同步日志兜底、配额与持久化提示 |
| 公告页 | **已上线** `/announcements`：全文列表、关键词搜索、级别筛选、未读计数、全部已读 |

### 随机额度发放实测记录

端到端在生产库上对 4 位真实用户发放 `[1000, 90000]` 区间的随机奖励：

| 场景 | 结果 |
|---|---|
| 预览 | `count:4, total_quota:182000, min_quota:1000, max_quota:90000, estimated:true`（中值 45500 × 4） |
| 实际发放 | `37623 / 28448 / 61654 / 42584`，**4 个值互不相同**，全部落在 `[1000, 90000]` |
| 活动总额 | `170309`，与四条明细之和**完全一致** |
| 用户侧渲染 | 3 张券金额各自不同（`$0.2` / `$0.082` / `$0.0752`），汇总 `$0.3572` 与券面之和一致 |
| 券面几何 | 比例 `1.7436`（设计值 1.7435）、撕口 2 个各 22px、打孔线 1 条、金额字号 36px |
| 领取上限 | `MaxQuotaLimit` 只在领取时按实际落库金额判断，随机值同样受封顶约束 |
| 校验 | 区间倒置（min > max）或 min ≤ 0 直接报 `REWARD_INVALID_AMOUNT` |
| 旧数据 | 活动 1–6 的 `random_min_quota` / `random_max_quota` 自动补 0，固定/比例模式行为不变 |

> 验证用的活动已撤回（`status: revoked`），未给真实用户留下测试奖励。


### 画布丢图修复实测记录

画布原本把「整块画布（含全部 base64）」当作一个记录写进 IndexedDB，500ms 防抖后才写，
失败被 `.catch(() => undefined)` 吞掉；Safari 对**所有可脚本写入的存储**（含 IndexedDB）
有「7 天未访问即清除」策略，且代码从未申请 `persist()`。生产环境三个生图模型都返回
`b64_json`（单张 1.3–1.4MB），所以主要丢失路径是配额耗尽 + 静默失败 + 防抖期间关页。

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 存储结构 | 单库单键，一张图改动重写全部图片 | `board`（布局）/`images`（每图一条），只写新增 |
| 旧数据 | — | v1 → v2 自动迁移，实测 `legacy prompt`、`keep me`、相机 `zoom 0.8` 全部保留，旧库已删 |
| 新图片落盘 | 等 500ms 防抖 | 生成后立刻 `saveImage()` 写入字节 |
| 关页/切走 | 无 flush，防抖中内容丢失 | `pagehide`/`visibilitychange` flush；IndexedDB 在 `pagehide` 无法提交，改由**同步 localStorage 日志**兜底 |
| 实测关页 | 输入后 120ms 离开 → 内容丢失 | 点「添加便签」后 120ms 日志已含新节点；立刻离开再回来 → 便签仍在并渲染 |
| 配额满 | 静默丢弃 | 抛 `quotaExceeded`，页面显示「存储已满，请先下载要保留的图片」 |
| 浏览器可能清除 | 无提示 | `navigator.storage.persist()` 协商；未获授权时提示「此浏览器可能清除画布数据」 |
| 临时链接生图 | 直接保存供应商 `url`（分钟级过期） | 取回字节转 data URL 永久保存；跨域不可读时保留链接 |

> **注意**：布局日志只存节点元数据，不含图片字节（`localStorage` 配额小，图片在 IndexedDB）。

### 公告页实测记录

参照 `site.whyapi.top/announcements` 的形态实现：列表直接显示**完整正文**（不是看板里的一行预览），
按发布时间倒序，点开单条进详情弹窗。数据仍走既有的 `console_setting.announcements` + `/api/status`，
没有新增后端字段，所以后台「内容管理 → 公告」编辑器照旧可用。

| 场景 | 结果 |
|---|---|
| 列表排序 | 后端已倒序，前端仍按 `publishDate` 重排（`status` 有 localStorage 缓存，旧副本不保证有序） |
| 未读计数 | 进入页面显示「N 条未读」，点开单条即计为已读，`全部标为已读` 后角标消失且按钮置灰 |
| 已读持久 | 复用 `notification-storage`（与通知铃铛同一份），刷新后仍为已读，实测 `readAnnouncementKeys: ["id:3","id:2","id:1"]` |
| 搜索 | 匹配正文与附加信息，不区分大小写；命中 1 条时显示「显示 1 / 3 条」 |
| 无 id 的公告 | 用正文指纹做已读键，编辑正文后会重新算作未读 |
| 级别筛选 | 五档（默认/进行中/成功/警告/错误）+ 全部；默认档也包含未填级别的条目 |
| 空状态 | 无公告时显示「暂无公告 / 站点管理员发布的新公告会显示在这里」 |
| 面板被关 | `announcements_enabled=false` 时显示「公告功能已关闭」，搜索与已读按钮一并隐藏 |
| 详情弹窗 | 标题「公告详情」+ 发布时间 + 正文（Markdown）+ 附加信息 |
| 看板入口 | 概览看板公告卡片右上角新增「查看全部」→ `/announcements`，实测点击后落在公告页 |
| 布局 | 桌面 1440px 条目宽 1190、手机 390px 宽 364，`scrollWidth == clientWidth`，无横向溢出 |
| 侧边栏 | 个人分组首位；后台「侧边栏模块」可单独关闭，用户个人设置里也能关 |

> **踩坑记录**：`SectionPageLayout` 只渲染 `Title`/`Actions`/`Content`/`Breadcrumb` 四个插槽，
> 其它子节点会被静默丢弃——弹窗一开始写在插槽旁边，测试里 `findByRole('dialog')` 永远等不到。
> 需要与页面并列渲染的浮层必须放在 `<SectionPageLayout>` 外面。

### 看板娘实测记录

| 场景 | 结果 |
|---|---|
| 桌面 1440×900 | 角色 148px，停在右下角 1204,734；双视频缓冲，`paused:false` |
| 手机 390×844 | 自动缩到 101px；`scrollWidth == innerWidth`，无横向溢出 |
| alpha 透明 | 角色像素 **82.6% 透明**（视频铺红底实测 83.2% 透出） |
| 首次问候 | 1.4s 后出气泡，文案已本地化（中文环境显示「嗨！我是泡泡，需要帮忙管理 API 密钥吗？」） |
| 点击 | 播一次性回应动画（`loop:false`），气泡开合并换随机立绘 |
| 拖拽 | 位移跟随，松手按速度抛掷；连续 4 次抛掷都从落点继续、始终不越界 |
| 抛掷方向 | 向左上甩 → 真的往左上飞（曾因坐标体系错误飞反并飞出屏幕，已修） |
| 窗口缩小 | 1440×900 → 420×380 时自动收到 200,230，`inside:true` |
| 减少动画 | 开启时 **0 个视频请求**；运行时切换立刻暂停（时间冻结），关闭后恢复播放 |
| 无障碍 | 透明按钮可 Tab 聚焦，`aria-label` 已本地化（「和泡泡打个招呼」） |
| 控制台错误 | 0 |

> **待办**：后台「服务器地址」还空着（`ServerAddress` 用的是硬编码默认值）。
> 去 `系统设置 → 站点与品牌` 填真实域名后，API 端点卡片就不再走降级分支。

> **注意**：动画里的角色是 dsh-pet 原作者形象，气泡立绘是定制的「泡泡」，
> 两者不是同一个角色（已确认可接受）。详见 3.8 节。

> **注意**：画布的内容只存在**当前浏览器**，没有服务端副本。清理浏览器数据、换设备、
> 无痕窗口都会看不到；Safari 甚至会在 7 天未访问后自行清除。要长期保存请用图片节点
> 菜单里的「Download image」。

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