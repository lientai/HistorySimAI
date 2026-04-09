# Commit 日志

## 2026-04-09: fix: harden rigid-mode turn flow, effect normalization, and nation UI gating

**Commit Hash**: (pending)

### 改动摘要

这一轮把近期几组真实玩法问题合并收口：修复科举 / 武举放榜后跨月不重置的问题，重写多任免诏书解析避免错配，提前规范化 LLM 返回的 appointments 结构，统一钱粮别名的数值结算路径，并继续清理困难模式下国家面板与季度体系的经典残留。

### 核心改动

| 文件 | 改动 | 说明 |
|------|------|------|
| `ChongzhenSim/js/systems/turnSystem.js` `ChongzhenSim/js/systems/kejuSystem.js` | ✏️ 修复 | 放榜后的科举 / 武举在月推进时自动重置，避免考务状态卡死 |
| `ChongzhenSim/js/utils/appointmentEffects.js` | ✏️ 重写 | 任免解析改为分句配对，支持多职位、多官员、连续 clause 与“着 / 仍掌 / 转任 / 兼任”等真实诏书语义 |
| `ChongzhenSim/js/api/validators.js` `ChongzhenSim/js/api/ministerChat.js` `ChongzhenSim/js/api/llmStory.js` | ✏️ 加固 | 在 API 边界更早规范化 appointments，减少名字 / ID 混用带来的二次错配 |
| `ChongzhenSim/js/utils/effectNormalization.js` `ChongzhenSim/js/utils/effectsProcessor.js` `ChongzhenSim/js/systems/storySystem.js` | ➕ 新增 / ✏️ 统一 | 把银两、现银、漕粮、存粮等别名收敛到统一 treasury / grain 结算链路，保证剧情、诏书、面板数值一致 |
| `ChongzhenSim/js/systems/coreGameplaySystem.js` `ChongzhenSim/js/api/requestContext.js` `ChongzhenSim/js/ui/nationView.js` | ✏️ 清理 | 困难模式不再保留季度议题、季度结算上下文和国家面板中的经典专属展示 |
| `ChongzhenSim/js/ui/nationView.test.js` 及相关测试文件 | ➕ 补测试 | 为考试重置、任免解析、数值归一化、困难模式季度屏蔽和国家面板隐藏经典块增加回归保护 |

### 价值

- **回合推进更稳定**：科举 / 武举不会再在放榜后卡住后续月份
- **诏书语义更可靠**：多任免文本和 LLM appointments 结构更接近真实意图
- **数值反馈更一致**：剧情、国家面板、诏书结算统一走同一条钱粮归一化路径
- **模式边界更清晰**：困难模式国家面板不再暴露经典季度体系残留

### 验证

- `npm test -- js/systems/kejuSystem.test.js js/systems/turnSystem.pipeline.test.js js/utils/appointmentEffects.test.js js/api/validators.test.js js/api/llmStory.test.js js/systems/storySystem.effects.test.js js/utils/effectsProcessor.test.js js/utils/displayStateMetrics.test.js js/systems/coreGameplaySystem.test.js js/api/requestContext.test.js js/ui/nationView.test.js` ✅ 通过（93 项）
- `npm run build` ✅ 通过

## 2026-04-09: feat: expand worldview-aware runtime and persistent browser storage

**Commit Hash**: `6df6c92`

### 改动摘要

把“世界观适配只覆盖静态数据”的现状继续往运行时推进：这次补齐了国策标题、季度议题、敌对势力、任命衍生数值、国家面板与请求上下文的世界观感知链路；同时新增浏览器持久化镜像层，让玩家配置和关键存档键即使在 `localStorage` 丢失后也能从 IndexedDB 自动恢复。

### 核心改动

| 文件 | 改动 | 说明 |
|------|------|------|
| `js/persistentBrowserStorage.js` | ➕ 新增 | 为玩家模型配置、活跃槽位、自动存档索引和多槽位存档键建立 `localStorage + IndexedDB` 双写镜像与自动回填机制 |
| `js/persistentBrowserStorage.test.js` | ➕ 新增测试 | 验证镜像键在本地存储被清空后可从 IndexedDB 回灌恢复 |
| `js/storage.js` `js/playerRuntimeConfig.js` | ✏️ 接入 | 存档与玩家运行时配置改为走持久化封装，避免关键浏览器数据仅依赖单层 `localStorage` |
| `js/worldview/worldviewAdapter.js` `public/data/worldviewOverrides.json` | ✏️ 扩展 | 新增 `policies` 世界观覆盖层，把南宋语义映射继续扩到国策目录 |
| `js/systems/coreGameplaySystem.js` | ✏️ 扩展 | 国策目录、季度议题、敌对势力初始化与战果结算改为支持世界观与显式战斗结果联动 |
| `js/api/requestContext.js` | ✏️ 修正 | LLM 请求上下文中的 `unlockedPolicyTitles` / `unlockedPolicyTitleMap` 改为读取世界观适配后的标题 |
| `js/utils/appointmentEffects.js` | ✏️ 扩展 | 任命效果新增军职强度推导，任命/罢免会同步反映到 `militaryStrength` 等状态收益 |
| `js/systems/militarySystem.js` `js/systems/storySystem.js` `js/ui/courtView.js` `js/ui/nationView.js` | ✏️ 对齐 | 运行时展示与结算文案继续向南宋世界观语义收敛 |
| `public/data/nationInit.json` | ✏️ 调整 | 初始化敌对势力与国家面板相关基础数据继续对齐当前世界观 |
| `ChongzhenSim/世界观导入自动适配AI规范.md` | ➕ 文档 | 明确世界观导入必须覆盖动态生成入口、请求上下文和统一适配层边界 |

### 价值

- **世界观一致性更强**：UI、LLM 请求上下文和运行时派生标题不再各自看到不同语义层
- **玩法反馈更真实**：任命军职会直接反馈到军事强度，战斗结果也能明确驱动敌对势力变化
- **浏览器侧容错更高**：玩家模型配置和关键存档键在存储丢失后有自动恢复能力

### 验证

- `npm run build` ✅ 通过
- `npm test -- js/api/requestContext.test.js js/systems/coreGameplaySystem.test.js js/systems/militarySystem.test.js js/utils/appointmentEffects.test.js js/worldview/southernSongAdapter.test.js js/persistentBrowserStorage.test.js` ✅ 通过（116 项）

## 2026-04-09: fix: harden local proxy fallback for court and story flows

**Commit Hash**: `f9863c5`

### 改动摘要

补强本地开发与线上代理并存时的 API 访问策略，让剧情和朝堂相关请求在浏览器本地运行、远端 Render 服务代理、以及自定义 `ALLOWED_ORIGINS` 配置下都能更稳定地工作；同时为法庭任命接口补上本地回退，避免服务端不可达时核心交互直接中断。

### 核心改动

| 文件 | 改动 | 说明 |
|------|------|------|
| `js/api/httpClient.js` | ✏️ 调整 | 统一本地浏览器下的 API base 选择逻辑；当配置指向 Render 远端时优先走当前 Vite 本地代理；新增 `shouldUseLlmProxy()` 供业务层复用 |
| `js/api/httpClient.test.js` | ➕ 补测试 | 覆盖 localhost 开发代理、浏览器 origin 回退、以及 LLM 代理启用条件 |
| `js/systems/storySystem.js` | ✏️ 收敛判断 | 改为复用 `shouldUseLlmProxy()`，避免剧情模块与 HTTP 客户端对代理启用条件判断不一致 |
| `js/ui/courtView.js` | ✏️ 加固 | 任命请求失败时回退到本地状态应用，并统一法庭视图重渲染入口 |
| `client/src/ui/views/court/CourtView.jsx` | ✏️ 调整 | 默认启用 legacy court layout，和当前法庭 DOM 视图挂载方式保持一致 |
| `server/index.js` | ✏️ 兼容 | 保留默认 localhost/CORS 白名单，即使外部自定义 `ALLOWED_ORIGINS` 也不会误伤本地开发预检 |
| `server/index.test.js` | ➕ 补测试 | 新增自定义允许源时 localhost 预检仍然通过的回归测试 |
| `vite.config.js` | ✏️ 调整 | 开发代理目标改为可配置，默认指向 Render 服务，并显式开启 HTTPS 代理校验 |

### 价值

- **本地联调更稳**：本地前端可通过当前 origin 代理远端 API，不再因为 `apiBase` 指向线上而绕过 Vite 代理
- **核心流程可降级**：任命接口异常时，朝堂职位调整仍可在前端本地状态中继续完成
- **环境兼容更强**：即使服务端定制了允许来源，本地 localhost 预检也不会被意外拒绝

### 验证

- `npm run build` ✅ 通过
- `npm test -- js/api/httpClient.test.js server/index.test.js` ✅ 通过（58 项）

## 2026-04-07: fix: stabilize production story requests and template fallback

**Commit Hash**: `ba9d32e`

### 改动摘要

修复上线后剧情接口在 Kurangames 域名下触发的 CORS 预检失败，并补强剧情模板回退逻辑，避免 LLM 请求失败后继续请求不存在的按年月生成静态剧情文件，导致玩家连续看到网络错误和 404。

### 核心改动

| 文件 | 改动 | 说明 |
|------|------|------|
| `server/index.js` | ✏️ 更新 | 扩展默认允许来源，支持 Kurangames 生产域名及其 HTTPS 子域名通过 CORS 预检 |
| `server/index.test.js` | ➕ 补测试 | 增加生产域名 `OPTIONS` 预检通过的回归测试 |
| `js/systems/storySystem.js` | ✏️ 加固 | 将剧情模板回退改为按顺序尝试“动态年月快照 -> 基线 phase 模板”，避免缺失文件时直接报错 |
| `js/systems/storySystem.template.test.js` | ➕ 新增测试 | 锁定 LLM 回退路径与困难模式首回合模板路径 |

### 价值

- **线上可用性**：嵌入 Kurangames 域名后，前端能正常访问 Render 代理接口
- **失败可降级**：当 LLM 请求失败或超时，剧情系统会回退到可用模板而不是中断
- **回归可控**：部署域名和剧情模板路径都有自动化测试保护

### 构建验证

- `npm run build` ✅ 通过（Vite 生产构建完成）

## 2026-04-07: fix: harden public config management and deploy defaults

**Commit Hash**: (pending)

### 改动摘要

收紧公网部署下的服务端默认配置管理能力，避免公开环境暴露 `config-status` 读写入口；同时补充本地开发配置说明，并将前端默认 API 地址切到线上 Render 服务，便于部署后直接联通后端。

### 核心改动

| 文件 | 改动 | 说明 |
|------|------|------|
| `.gitignore` | ✏️ 更新 | 忽略 `ChongzhenSim/server/config.json`，避免误提交本地敏感配置 |
| `public/data/config.json` | ✏️ 更新 | 默认 `apiBase` 从本地地址切换到线上 Render 服务地址 |
| `server/config.example.json` | ✏️ 补充说明 | 明确这是本地开发回退配置，不应提交真实 API Key |
| `server/index.js` | ✏️ 加固 | 新增公网/回环来源判定，默认仅允许本地环境访问和写入 `config-status` |
| `server/index.test.js` | ➕ 补测试 | 增加公网访问 `config-status` 被拒绝的测试，并为本地管理场景显式打开测试开关 |

### 价值

- **部署更安全**：公网实例默认不再暴露服务端模型配置读写入口
- **本地开发更清晰**：配置样例和接口提示明确区分开发用途与公网用途
- **上线更直接**：前端默认请求地址已对齐线上服务，减少部署后的额外手工修改

## 2026-04-06: refactor: unify start/settings views with shared UI primitives

**Commit Hash**: (pending)

### 改动摘要

为开始页和设置页补齐共享 UI 基元与主题 token，收拢原本分散的内联样式和页面私有按钮结构，作为后续持续加玩法页面时的统一骨架。

### 核心改动

| 文件 | 改动 | 说明 |
|------|------|------|
| `js/ui/viewPrimitives.js` | ➕ 新增 | 提供 `createViewShell`、`createSectionCard`、`createActionButton`、`createInfoLine` 等轻量 DOM/UI 基元 |
| `js/ui/startView.js` | ✏️ 重构 | 开始页改为复用共享基元，移除大部分内联样式 |
| `js/ui/settingsView.js` | ✏️ 重构 | 设置页改为区块化结构，统一存档、模式、运行信息和返回操作 |
| `css/theme.css` | ✏️ 扩展 | 新增 surface、radius、spacing、transition 等主题 token |
| `css/components/common.css` | ✏️ 扩展 | 新增 view shell、section card、button、tag、info line、select 等通用样式 |
| `css/modules/edict.css` | ✏️ 调整 | 开始页保留场景化视觉，但改为建立在共享基元之上 |
| `js/ui/viewPrimitives.test.js` | ➕ 新增测试 | 锁定共享基元的结构输出，避免后续页面扩展时回归 |
| `README.md` | ✏️ 文档 | 补充 UI 维护约定，明确新增页面优先复用共享基元 |

### 价值

- **长期维护**：页面结构和交互风格有统一入口，减少“每页一套写法”
- **持续加玩法**：新玩法页可以直接复用视图骨架、区块卡片和按钮模式
- **UI 一致性**：开始页与设置页的标题、按钮、说明文案和区块层次统一
- **开发速度**：减少重复拼装 DOM 和反复写内联样式的成本

## 2026-04-03: feat: 军事系统扩展/优化/融合版本完整实现 + 75 项测试全覆盖

**Commit Hash**: (pending)

### 改动摘要

根据《骑马与砍杀2核心注意力消耗玩法模块开发文档》，系统性补全了**扩展版本、优化版本、融合版本**三阶段缺失功能，
并新增 27 项单元测试，全项目 244 条测试全部通过（原 217 → 现 244）。

### 核心改动

| 文件 | 改动 | 说明 |
|------|------|------|
| `js/systems/militarySystem.js` | ✅ 新增功能 | 扩展/优化/融合版本实现 |
| `js/systems/militarySystem.test.js` | ✅ 新增测试 | 27 项新测试，覆盖全部新特性 |

### 设计文档四阶段完成情况

| 版本 | 特性 | 状态 |
|------|------|------|
| **基础版本** | 阵型/兵种/主将基础/士气/基础野战 | ✅ 已有（48 测试） |
| **扩展版本** | 天气（雨/雪）、主将亲率+负伤、弹药耗尽、局部溃败扩散 | ✅ 本次实现 |
| **优化版本** | `UNIT_TYPES` / `FORMATIONS` 导出，支持外部 AI 调参 | ✅ 本次实现 |
| **融合版本** | 俘虏处理（`prisoners`）、战后恢复期（`recoveryDays`）写入 effectsPatch | ✅ 本次实现 |

### 新增功能详情

**扩展版本**
- `deriveWeatherFromText()` 导出：从诏书文本推断战场天气（雨/雪/晴）
- `buildInitialSession()` 新增字段：`weather`、`commanderInjured`、`ammo`、`initialEnemyCount`
- `resolveBattleRound()` 新参数 `_injuryRoll`（测试确定性）及新返回值 `commanderInjuredThisRound`、`updatedAmmo`
- 雨天：火铳哑火（攻击=0）；雪天：骑兵攻击力 ×0.6
- 主将亲率（`commanderCharge`）：全军士气+30，20% 负伤概率；负伤后指挥效率 ×0.5
- 弹药系统：`ammo.firearm` / `ammo.artillery` 每回合递减，耗尽则无法攻击
- 局部溃败扩散：有编队士气 < 30 时，友军额外受 collapsingCount×8 的士气惩罚

**优化版本**
- `UNIT_TYPES` 和 `FORMATIONS` 改为 `export const`，支持外部程序直接读取/修改数值后再战

**融合版本**
- `buildBattleEffectsPatch` 新增 `prisoners = enemyKilled × 30%`（胜利专属）
- `buildBattleEffectsPatch` 新增 `recoveryDays = casualtyRate × 30`（战后恢复期天数）
- `renderSummaryPhase` 展示歼敌数、可俘虏兵力、伤兵恢复期
- `buildImpactLines` 展示俘虏处理提示和恢复期提示


- **`.mil-overlay`** — 横向行纹（军册纸感）背景，顶部旗幡渐变彩条，右上角兵符斜边
- **`.mil-phase-title`** — 鎏金字 + 铜线底划 + 左侧菱形战旗符；胜 / 败变色
- **`.mil-section-label`** — 左侧军令竖符（暗红→铜色渐变）
- **`.mil-unit-card`** — 切角令牌clip-path，铜边 + 顶部光线
- **`.mil-formation-btn`** — 军令竹简风，左侧暗红竖条，激活态鎏金高亮
- **`.mil-decision-btn`** — 军令签，左侧4px血红条，「令」字水印，hover铜色高光
- **`.mil-status-card--player/enemy`** — 战报奏折风，顶部彩条区分我/敌
- **`.mil-battle-log`** — 军册滚动记录，细边铜色滚动条，▸ 前缀红箭标
- **`.mil-stat-card`** — 军功册格，右下角小三角勋章装饰
- **`.mil-primary-btn`** — 官印钤章风，圆形水印 + 上方金色高光线，hover 展宽字距

## 2026-03-27: feat: character death detection in appointment effects

**Commit Hash**: (pending)

### 改动摘要

为官员任免系统增加了赐死（处死）官员的检测逻辑，使得两种游戏模式（经典、困难）都能从圣旨文本中识别官员处死事件，并自动关闭相关的故事线。

### 核心改动

| 文件 | 改动 | 作用 |
|------|------|------|
| `js/utils/appointmentEffects.js` | ✏️ 新增死亡模式识别 | 1) 添加deathKeyword正则（赐死、赐予自尽、自尽、饮鸩等）；2) 近邻匹配（0-2字）防止跨句捕获；3) 返回characterDeath字段到effects对象 |
| `js/utils/appointmentEffects.test.js` | ➕ 新增2个测试 | 1) 单独赐死检测测试；2) 组合效果测试（任免+赐死混合） |

### 赐死关键词模式

```javascript
deathKeyword = /(?:赐死|赐予自尽|赐自尽|赐予|自尽|饮鸩|毒酒)/
// 近邻范围: 官员名 ±0-2字 赐死关键词
// 示例: "赐死温体仁" ✅ | "赐死 毕自严为内阁" ❌ (超出范围)
```

### 处理流程

**文本提取** → **模式识别** → **效果生成** → **状态应用**

1. `deriveAppointmentEffectsFromText()` 扫描圣旨文本
2. 近邻正则 `keyword.{0,2}name|name.{0,2}keyword` 匹配
3. 生成 `{ characterDeath: { characterId: "赐死" } }`
4. 两种模式都调用共享的 `applyEffects()`:
   - 标记官员 `isAlive = false`
   - 记录死因和日期
   - 关闭该官员相关的故事线

### 测试结果

## 2026-04-07: feat: migrate simulator to Southern Song runtime shell

**Commit Hash**: (pending)

### 改动摘要

完成一轮较大规模的题材与运行时改造：将游戏主叙事从明末崇祯朝迁移到南宋建炎年间，引入 `client/server` 启动壳与 React 外层界面，补齐玩家本地运行时模型配置入口，并新增 Fleet 工作流、无头试玩回归和世界观适配层，为后续继续扩展玩法与自动化验证打下基础。

### 核心改动

| 文件 / 目录 | 改动 | 说明 |
|------|------|------|
| `client/` | ➕ 新增 | 引入 React 启动壳、顶部/底部导航、设置页与旧 DOM 视图挂载桥接 |
| `js/main.js` `js/router.js` `js/state.js` | ✏️ 重构 | 兼容新启动方式与 React 外层壳，保留旧系统核心逻辑 |
| `js/playerRuntimeConfig.js` `client/src/bootstrap/configurationGate.js` | ➕ 新增 | 支持每个玩家在浏览器本地保存自己的 LLM 配置 |
| `server/index.js` `server/worldviewAdapter.cjs` `server/worldviewPrompt.cjs` | ✏️ 扩展 | 服务端改为支持世界观适配、动态 prompt 注入、运行时配置写入与端口兼容 |
| `public/data/*.json` `public/data/story/*.json` | ✏️ 大量改写 | 将角色、派系、开场文案、目标、事件、剧情文本整体迁移到南宋建炎叙事 |
| `public/data/worldview.json` `public/data/worldviewOverrides.json` `js/worldview/` | ➕ 新增 | 建立玩法骨架与世界观皮层分离的适配数据层 |
| `vite.config.js` `vitest.config.js` | ✏️ 调整 | 切到 `client` 为入口，补齐 React 与别名解析 |
| `scripts/headless-playtest.mjs` `scripts/verify-player-experience.mjs` | ➕ 新增 | 增加 24 回合无头试玩、跨策略回归与玩家体验验证脚本 |
| `.fleet/` `scripts/fleet-runner.mjs` `scripts/fleetRunnerCore.mjs` | ➕ 新增 | 新增 Fleet 三段式工作流与 PR/阶段报告生成能力 |
| `server/index.test.js` `js/testing/` `client/src/**/*.test.js` | ➕ 扩展测试 | 为配置门禁、世界观适配、无头试玩和新前端启动层补测试 |

### 价值

- **题材迁移完成度更高**：静态数据、剧情文本、服务端提示词与角色语义已同步迁移到南宋建炎背景
- **架构更清晰**：形成 `client/server` 启动壳 + 旧玩法核心并存的渐进式迁移路径
- **玩家配置更安全**：模型 Key 改为每位玩家在本地浏览器持有，不再强依赖单份服务端配置
- **自动化验证更强**：新增无头 24 回合体验回归、多策略回归和 Fleet 流程化报告
- **后续扩展更稳**：世界观适配层与共享 UI/视图桥接让继续加玩法、换题材、做验证都更可维护

✅ 7/7 appointmentEffects测试通过  
✅ 169/169 全套测试通过（无回归）  
✅ 经典模式：LLM生成的圣旨现支持赐死提取  
✅ 困难模式：规则引擎生成的效果现支持赐死检测

### 关键设计决策

**近邻限制0-2字**: 允许"赐死 官名"但阻止跨标点如"赐死；任命新官"

---

## 2026-03-27: refactor: unified and merged metrics for rigid/classic modes

**Commit Hash**: (pending)

### 改动摘要

完全重构国家界面的数值展示系统，实现困难模式和经典模式的指标合并、单位统一和面板优化：
- 统一困难模式财务数据单位（国库、内帑）为"两"单位，与经典模式保持一致
- 修复困难模式数值显示中的小数问题，确保所有指标为整数
- 隐藏困难模式下的"大明国势"和"朝局总览"两个面板
- 在困难模式下新建"崇祯·大明国势"面板，整合19项关键指标
- 经典模式保留原有的"大明国势"和"朝局总览"两个面板

### 核心文件改动

| 文件 | 改动 | 作用 |
|------|------|------|
| `js/utils/displayStateMetrics.js` | ✏️ 修改指标定义 + 数值转换逻辑 | 1) rigidTreasury/rigidInnerFund改用treasury格式；2) getDisplayMetricValue中对rigid财务数据×10000转换；3) formatDisplayMetricValue确保所有值四舍五入为整数 |
| `js/ui/nationView.js` | ✏️ 改造面板渲染逻辑 | 1) classic模式显示原有两个面板；2) rigid模式隐藏这两个面板，新建合并面板；3) 合并面板包含5项分类、19个指标 |

### 困难模式新面板结构："崇祯·大明国势"

**财务状况** (4项):
- 💰 国库 (rigidTreasury × 10000 = 两)
- 🪙 内帑 (rigidInnerFund × 10000 = 两)
- 📉 军饷拖欠 (rigidMilitaryArrears)
- 📜 官俸拖欠 (rigidOfficialArrears)

**国家形势** (4项):
- 👥 民心 (civilMorale)
- 🛡️ 边患 (borderThreat)
- 🌪️ 天灾 (disasterLevel)
- 🧾 贪腐 (corruptionLevel)

**军事力量** (3项):
- ⚔️ 辽东兵力 (rigidLiaoDongTroops)
- 🪖 辽东军心 (rigidLiaoDongMorale)
- 🚨 流寇规模 (rigidRebelScale)

**朝廷局势** (4项):
- 👑 权威 (rigidAuthority)
- ⚖️ 党争 (rigidFactionFight)
- 🧱 阻力 (rigidResistance)
- 📌 封驳次数 (rigidRefuteTimes)

**皇帝状态** (5项):
- 😰 焦虑 (rigidAnxiety)
- 🌙 失眠 (rigidInsomnia)
- 🕵️ 暴露风险 (rigidExposureRisk)
- 🗡️ 暗杀风险 (rigidAssassinateRisk)
- 🫥 疑心 (rigidDistrust)

### 关键修复

✅ **单位统一**: 困难模式财务数据从"万两"缩放→"两"，与经典模式国库单位一致
✅ **小数修复**: 所有指标通过Math.round()确保为整数，不显示.5这样的小数
✅ **面板优化**: rigid模式只显示一个统一的综合面板，减少UI冗余
✅ **去重复**: 合并了重复的"党争"等指标，优先使用rigid版本

### 数据流

```
rigid state: finance.treasury (30)
    ↓ × 10000
经典单位: 300000 两
    ↓ 
formatTreasury() → "300,000两"
    ↓
UI显示
```

### 测试结果

✅ 所有165个测试通过
✅ 无语法错误
✅ 向后兼容：经典模式界面不变

---

## 2026-03-27: refactor: separate execution constraints from narrative display

**Commit Hash**: de2cc57

### 改动摘要

系统约束信息从 UI 显示分离，改由 ExecutionConstraint 机制处理：
- 这些信息现在作为"系统推理约束"传入 LLM，而非直接显示给玩家
- 与困难模式记忆锚点同级，共同形成"推理约束链"

### 核心文件改动

| 文件 | 改动 | 作用 |
|------|------|------|
| `js/rigid/memory.js` | +3 函数 | `createExecutionConstraint()`, `appendExecutionConstraint()`, `getLatestExecutionConstraint()` |
| `js/rigid/engine.js` | 导入新函数、集成调用 | 每回合生成并保存约束快照 |
| `js/api/requestContext.js` | +1 字段 | `body.rigid.latestExecutionConstraint` for LLM |
| `js/rigid/moduleComposer.js` | Module2 精简 | 8 字段 → 3 字段，移除系统信息字段 |
| `js/rigid/config.js` | +1 字段 | `executionConstraints: []` 初始化 |
| `js/rigid/moduleComposer.test.js` | 更新测试 | 适应 3-字段结构 |

### 数据流

```
决策完成 
  ↓
createExecutionConstraint() → 包含执行率、封驳、阈值等
  ↓
appendExecutionConstraint() → 存入 state.rigid.executionConstraints
  ↓
buildStoryRequestBody() → latestExecutionConstraint 传入 LLM
  ↓
UI 故事显示 ← 仅显示叙述 (Module2: 开篇、圣断、自述)
```

### 测试结果

- ✅ 159/159 tests passing
- ✅ 无遗漏、无回归

### 设计提升

1. **关注点分离**: 系统信息 vs. 故事叙述
2. **LLM 约束完整**: 执行折扣 + 记忆链 + 阈值触发
3. **UI 清洁**: 不显示内部机制数字

---

## 记忆锚点 + 执行约束 = 完整的推理约束链

- **记忆锚点**: 过去的状态快照 (turn, year, month, risk values)
- **执行约束**: 本回合的结果快照 (execution rates, refute status, triggered events)
- **LLM 接收**: 两者都在请求体中，形成"约束链"
- **UI 显示**: 仅故事叙述，约束信息用于 LLM 推理而非展示

---

## 2026-03-26 以来变更补全（精简版，含文件）

### 2026-03-26 · 0d9349c76f1b42f9993e050533671a3b6d9ff559
- 摘要：处理冲突相关提交。
- 改动文件：
  - `.gitignore`

### 2026-03-26 · 06a813a0cbd5551a1db768bad28ff6f0414bb311
- 摘要：武举/任命规则联动、角色池扩充与寿命调整、剧情上下文压缩与本地约束、敌对势力复活链路。
- 改动文件：
  - `ChongzhenSim/data/characters.json`
  - `ChongzhenSim/js/api/llmStory.js`
  - `ChongzhenSim/js/api/requestContext.js`
  - `ChongzhenSim/js/api/validators.js`
  - `ChongzhenSim/js/api/validators.test.js`
  - `ChongzhenSim/js/main.js`
  - `ChongzhenSim/js/state.js`
  - `ChongzhenSim/js/systems/coreGameplaySystem.js`
  - `ChongzhenSim/js/systems/kejuSystem.js`
  - `ChongzhenSim/js/systems/storySystem.js`
  - `ChongzhenSim/js/systems/turnSystem.js`
  - `ChongzhenSim/js/ui/courtView.js`
  - `ChongzhenSim/js/ui/edictView.js`
  - `ChongzhenSim/js/utils/appointmentEffects.js`
  - `ChongzhenSim/js/utils/characterArchetype.js`
  - `ChongzhenSim/js/utils/displayStateMetrics.js`
  - `ChongzhenSim/js/utils/storyFacts.js`
  - `ChongzhenSim/js/utils/storyParser.js`
  - `ChongzhenSim/js/utils/storyRenderer.js`
  - `ChongzhenSim/scripts/expand_characters_temp.js`
  - `ChongzhenSim/scripts/refine_new_characters_temp.js`
  - `ChongzhenSim/server/index.js`

### 2026-03-27 · 652afacf79fa9dc086b4bb36fe023865424da2c8
- 摘要：困难模式开场链路修复（点击无响应）、独立时间线与规则链路修正。
- 改动文件：
  - `ChongzhenSim/css/theme.css`
  - `ChongzhenSim/data/config.json`
  - `ChongzhenSim/data/rigidHistoryEvents.json`
  - `ChongzhenSim/data/rigidInitialState.json`
  - `ChongzhenSim/data/rigidTriggers.json`
  - `ChongzhenSim/data/story/hard_mode_day1_morning.json`
  - `ChongzhenSim/js/api/requestContext.js`
  - `ChongzhenSim/js/api/requestContext.test.js`
  - `ChongzhenSim/js/main.js`
  - `ChongzhenSim/js/rigid/config.js`
  - `ChongzhenSim/js/rigid/decisionCheck.js`
  - `ChongzhenSim/js/rigid/engine.js`
  - `ChongzhenSim/js/rigid/engine.test.js`
  - `ChongzhenSim/js/rigid/history.js`
  - `ChongzhenSim/js/rigid/mechanisms.js`
  - `ChongzhenSim/js/rigid/memory.js`
  - `ChongzhenSim/js/rigid/moduleComposer.js`
  - `ChongzhenSim/js/rigid/moduleComposer.test.js`
  - `ChongzhenSim/js/rigid/settlement.js`
  - `ChongzhenSim/js/rigid/valueCheck.js`
  - `ChongzhenSim/js/state.js`
  - `ChongzhenSim/js/storage.js`
  - `ChongzhenSim/js/systems/storySystem.js`
  - `ChongzhenSim/js/systems/turnSystem.js`
  - `ChongzhenSim/js/systems/turnSystem.pipeline.test.js`
  - `ChongzhenSim/js/ui/settingsView.js`
  - `ChongzhenSim/js/ui/startView.js`
  - `ChongzhenSim/js/utils/displayStateMetrics.js`
  - `ChongzhenSim/js/utils/displayStateMetrics.test.js`
  - `ChongzhenSim/困难模式设计文档.md`
  - `ChongzhenSim/经典模式与困难模式对比文档.md`

### 2026-03-27 · ba864fe6f2beb754ee984c7182ff4faf8dd8a624
- 摘要：修复 `hard_mode_day1_morning.json` 的 JSON 语法错误。
- 改动文件：
  - `ChongzhenSim/data/story/hard_mode_day1_morning.json`

### 2026-03-27 · de2cc5782512132d8c30c5913c3f2605c30b04a5
- 摘要：将执行约束从叙事展示中拆分，改为 LLM 推理约束链输入。
- 改动文件：
  - `ChongzhenSim/js/api/requestContext.js`
  - `ChongzhenSim/js/rigid/config.js`
  - `ChongzhenSim/js/rigid/engine.js`
  - `ChongzhenSim/js/rigid/memory.js`
  - `ChongzhenSim/js/rigid/moduleComposer.js`
  - `ChongzhenSim/js/rigid/moduleComposer.test.js`

### 当前未提交改动（工作区）
- 摘要：动态选项兜底、国势面板合并优化、任免/赐死效果与资源估算增强、科举候选生成默认逻辑调整、相关测试同步。
- 改动文件：
  - `ChongzhenSim/js/rigid/engine.js`
  - `ChongzhenSim/js/rigid/engine.test.js`
  - `ChongzhenSim/js/rigid/moduleComposer.js`
  - `ChongzhenSim/js/systems/kejuSystem.js`
  - `ChongzhenSim/js/systems/kejuSystem.test.js`
  - `ChongzhenSim/js/systems/storySystem.js`
  - `ChongzhenSim/js/systems/turnSystem.js`
  - `ChongzhenSim/js/systems/turnSystem.pipeline.test.js`
  - `ChongzhenSim/js/ui/courtView.js`
  - `ChongzhenSim/js/ui/nationView.js`
  - `ChongzhenSim/js/utils/appointmentEffects.js`
  - `ChongzhenSim/js/utils/appointmentEffects.test.js`
  - `ChongzhenSim/js/utils/displayStateMetrics.js`
  - `ChongzhenSim/经典模式与困难模式对比文档.md`

---

## 2026-03-28: chore: ignore 模式设计文档并整理提交

**Commit Hash**: (pending)

### 改动摘要

- 将困难模式设计文档与经典/困难模式对比文档加入 `.gitignore`。
- 从 Git 索引移除以上两个文档（保留本地文件），后续不再参与版本控制。
- 合并提交当前工作区内的困难模式链路优化、数值展示与测试更新。

### 改动文件

- `.gitignore`
- `ChongzhenSim/困难模式设计文档.md`（从索引移除）
- `ChongzhenSim/经典模式与困难模式对比文档.md`（从索引移除）
- `ChongzhenSim/js/rigid/engine.js`
- `ChongzhenSim/js/rigid/engine.test.js`
- `ChongzhenSim/js/rigid/moduleComposer.js`
- `ChongzhenSim/js/systems/kejuSystem.js`
- `ChongzhenSim/js/systems/kejuSystem.test.js`
- `ChongzhenSim/js/systems/storySystem.js`
- `ChongzhenSim/js/systems/turnSystem.js`
- `ChongzhenSim/js/systems/turnSystem.pipeline.test.js`
- `ChongzhenSim/js/ui/courtView.js`
- `ChongzhenSim/js/ui/nationView.js`
- `ChongzhenSim/js/utils/appointmentEffects.js`
- `ChongzhenSim/js/utils/appointmentEffects.test.js`
- `ChongzhenSim/js/utils/displayStateMetrics.js`

---

## 2026-03-28: chore: ignore 科举功能模块文档

**Commit Hash**: (pending)

### 改动摘要

- 将根目录 `科举功能模块.md` 加入 `.gitignore`。
- 清理该文档的版本跟踪，避免后续再次误入提交。
- 补充本次补救提交记录。

### 改动文件

- `.gitignore`
- `科举功能模块.md`（停止跟踪）
- `commit.md`
