# Repository Full Change Log (Commit2)

## 1. 概览
- 时间范围：2026-03-13 至 2026-03-18
- 提交总数：12
- 主要贡献者：
  - JINTIAN-LIU（5）
  - seanfan（3）
  - 吴同（4，含 2 个邮箱身份）

本文件按 PR 描述风格，汇总本地仓库建立以来的所有历史改动，并补充逻辑自检结论。

---

## 2. 全量提交时间线（按时间正序）

### 2.1 d79c560 · 2026-03-13 · Initial commit
- 变更规模：682 files changed, +73,730
- 关键内容：
  - 建立项目基础骨架（前端、后端、资源、依赖）
  - 初始玩法与页面结构落地
  - `ChongzhenSim/server/node_modules`、`package-lock` 等依赖文件被纳入

### 2.2 b111dfb · 2026-03-13 · Create README.md
- 变更规模：1 file changed, +56
- 关键内容：
  - 新增仓库说明文档 `README.md`

### 2.3 a4fffef · 2026-03-13 · Update README.md
- 变更规模：1 file changed, +2
- 关键内容：
  - README 细节更新

### 2.4 1f90bf5 · 2026-03-14 · Add files via upload
- 变更规模：1 file changed, +281 / -235
- 关键内容：
  - 重点修改 `ChongzhenSim/server/index.js`
  - 后端剧情代理逻辑与提示词/接口实现迭代

### 2.5 34ef229 · 2026-03-14 · Add files via upload
- 变更规模：2 files changed, +629 / -568
- 关键内容：
  - 重点修改：
    - `ChongzhenSim/js/systems/nationSystem.js`
    - `ChongzhenSim/js/systems/storySystem.js`
  - 核心玩法系统与叙事系统重构

### 2.6 d799c80 · 2026-03-14 · Add files via upload
- 变更规模：1 file changed, +8 / -8
- 关键内容：
  - `ChongzhenSim/data/goals.json` 调整

### 2.7 01870b5 · 2026-03-14 · Merge pull request #1 from tmadmao/main
- 变更规模：Merge commit（无独立 shortstat）
- 关键内容：
  - 合并上游/分支改动，统一主线

### 2.8 99a8dd8 · 2026-03-17 · 月度化+季度化玩法大更新
- 变更规模：688 files changed, +75,670
- 关键内容：
  - 玩法节奏从“日”改为“月”，引入季度结算
  - 引入国策树与皇帝成长等系统化玩法
  - 大范围更新数据、UI、系统层与后端：
    - `ChongzhenSim/data/*`
    - `ChongzhenSim/js/api/*`
    - `ChongzhenSim/js/systems/*`
    - `ChongzhenSim/js/ui/*`
    - `ChongzhenSim/server/*`

### 2.9 ca0fc27 · 2026-03-17 · 恢复配置文件
- 变更规模：1 file changed, +4 / -4
- 关键内容：
  - `ChongzhenSim/server/config.json` 配置修复

### 2.10 76daa6c · 2026-03-17 · merge upstream/main: resolve conflicts
- 变更规模：Merge commit（无独立 shortstat）
- 关键内容：
  - 同步并解决上游冲突

### 2.11 03038a1 · 2026-03-17 · 季度议题/敌对势力/50国策/平衡验证
- 变更规模：14 files changed, +1,473 / -64
- 关键内容：
  - 新增/外置平衡配置：`ChongzhenSim/data/balanceConfig.json`
  - 新增省份动态规则：`ChongzhenSim/data/provinceRules.json`
  - 核心玩法系统扩展：`ChongzhenSim/js/systems/coreGameplaySystem.js`
  - 季度与叙事联动：`storySystem.js`, `turnSystem.js`, `nationView.js`
  - 增加平衡回归脚本：`ChongzhenSim/scripts/balanceCheck.mjs`
  - 后端与接口联动更新：`server/index.js`, `api/llmStory.js`, `api/ministerChat.js`

### 2.12 236a66c · 2026-03-18 · 季度奏折上下文驱动 + 冗余优化
- 变更规模：10 files changed, +651 / -223
- 关键内容：
  - 季度奏折从固定模板转为上下文驱动
  - 新增 API 公共模块，减少重复代码：
    - `ChongzhenSim/js/api/httpClient.js`
    - `ChongzhenSim/js/api/requestContext.js`
    - `ChongzhenSim/js/api/validators.js`
  - 调整季度 UI 与文案分层：
    - `ChongzhenSim/css/components.css`
    - `storySystem.js`, `coreGameplaySystem.js`

---

## 3. 关键演进主线（跨提交归纳）

### 3.1 基础搭建阶段（03-13）
- 完成项目可运行框架与文档初始化

### 3.2 玩法与系统重构阶段（03-14）
- 对剧情系统、国势系统、目标配置进行结构化改造

### 3.3 月度/季度核心玩法成型阶段（03-17）
- 月度回合、季度结算、国策树、成长体系进入主干
- 引入敌对势力可打击到灭亡的连续战事逻辑

### 3.4 数据驱动与质量优化阶段（03-17 ~ 03-18）
- 平衡参数外置（`balanceConfig.json`）
- 省份规则外置（`provinceRules.json`）
- API 请求构造/校验/HTTP 调用模块化，减少冗余
- 季度奏折实现“上下文承接 + 优先级分层（急/重/缓）”

---

## 4. 自检逻辑结论

### 4.1 完整性自检
- 已覆盖从首个提交到当前 HEAD 的 12 条提交记录（含 2 条 merge commit）。
- 时间线、提交哈希、作者、主题与 shortstat 一致。

### 4.2 一致性自检
- 历史描述与最近实际改动方向一致：
  - 季度奏折上下文驱动
  - 平衡配置外置
  - API 冗余清理
  - UI 优先级分层

### 4.3 风险与建议
- 历史中多次提交了 `server/node_modules`，会造成仓库膨胀与审阅噪声。
- 建议后续将依赖目录从版本库中移除并使用锁文件管理（保留 `package-lock.json`）。

---

## 5. 结论
- 本地仓库自建立以来的改动已形成完整闭环：
  - 从初始框架到玩法主循环
  - 从功能堆叠到数据驱动
  - 从可用到可维护（去冗余、统一校验、回归验证）
- 当前提交历史可直接作为 PR 汇总或阶段性里程碑说明基础版本。

---

## 6. 增量提交记录（持续追加）

本节用于“每次提交后立即补录”，不改动上方历史正文，仅增量追加，便于长期维护。

### 6.1 最新提交快照（2026-03-18）

#### 6.1.1 3883ca3 · merge upstream/main into my-feature-branch
- 全哈希：`3883ca356f2fcc7de35a9b8481e674c501cb513a`
- 作者：JINTIAN-LIU
- 类型：Merge Commit
- 目的：同步上游分支，吸收最新改动并继续在 `my-feature-branch` 开发。

#### 6.1.2 a002b54 · merge feat(官位任命系统) into my-feature-branch
- 类型：Merge Commit
- 目的：合并官位任命系统模块到当前开发分支，推进玩法兼容。

#### 6.1.3 88bee5e · 详细说明该PULL REQUEST改动
- 类型：Documentation / Chore
- 目的：补充 PR 说明，完善改动背景与评审信息。

#### 6.1.4 388ba43 · fix(court): optimize appointment flow and fix api/avatar issues
- 全哈希：`388ba43ac4d2260c67520c7c4cfc591387f898b2`
- 时间：2026-03-18
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/js/ui/courtView.js
  - ChongzhenSim/css/components.css
- 玩法兼容与冲突取舍：
  - 朝堂任命链路改为“选择 + 确认”，降低误触并提升操作反馈。
  - 前端任命接口统一走 apiBase，兼容 8080 静态页 + 3002 API 服务拆分。
  - 头像加载增加本地回退策略，缺失资源不再持续触发 404 噪音。
- 自检结果：
  - Root：`npm --prefix ChongzhenSim test --silent` 通过（98/98）
  - Server：`npm --prefix ChongzhenSim/server test --silent` 通过（49/49）

#### 6.1.5 c98d33c · feat(court): switch appointment to inline text panel
- 全哈希：`c98d33cc6d2a2378861f5dd9fb461001d060b36e`
- 时间：2026-03-18
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：feat
- 变更文件：
  - ChongzhenSim/js/ui/courtView.js
  - ChongzhenSim/css/components.css
- 玩法兼容与冲突取舍：
  - 朝堂“任命/调整”改为页内面板，不再使用弹窗链路，提升连续操作体验。
  - 任命候选改为纯文字信息（姓名/字号/派系/忠诚或官职占位），去除图片展示。
  - 保留现有 appoint API 调用和任命状态更新逻辑，避免破坏服务端兼容。
- 自检结果：
  - Root：`npm --prefix ChongzhenSim test --silent` 通过（98/98）
  - Server：`npm --prefix ChongzhenSim/server test --silent` 通过（49/49）

#### 6.1.6 8364098 · fix(court): restore click response and reduce missing-resource 404
- 全哈希：`8364098acfc3e2c64389e0c33251ade062a1596f`
- 时间：2026-03-18
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/js/ui/courtView.js
  - ChongzhenSim/js/systems/storySystem.js
  - ChongzhenSim/js/utils/storyRenderer.js
  - ChongzhenSim/index.html
- 玩法兼容与冲突取舍：
  - 修复朝堂任命点击“无反应”：重渲染容器改为路由实际使用的 `main-view`。
  - 模板剧情加载改为按 phase 读取 `day1_*` 基准脚本，避免 year/month 路径缺失导致中断。
  - 对话头像缺图直接文字回退，不再重复请求不存在图片。
  - 增加 favicon 显式声明，去除默认 `/favicon.ico` 404 噪音。
- 自检结果：
  - Root：`npm --prefix ChongzhenSim test --silent` 通过（98/98）
  - Server：`npm --prefix ChongzhenSim/server test --silent` 通过（49/49）

#### 6.1.7 ead353d · feat(court): anchor appointment panel under department
- 全哈希：`ead353d450b7561d8262e1088da6ae74908d3ec3`
- 时间：2026-03-18
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：feat
- 变更文件：
  - ChongzhenSim/js/ui/courtView.js
- 玩法兼容与冲突取舍：
  - 任命面板从页面顶部统一区域改为挂在对应部门分组下方，交互定位更直观。
  - 按官职任命时严格贴合该部门；按大臣调整时优先贴合当前任职部门。
  - 保持原有“选择 + 确认”机制与服务端接口兼容，不改变核心任命逻辑。
- 自检结果：
  - Root：`npm --prefix ChongzhenSim test --silent` 通过（98/98）
  - Server：`npm --prefix ChongzhenSim/server test --silent` 通过（49/49）

#### 6.1.8 2a9e718 · feat(story): add per-turn underline highlights with timestamped collection
- 全哈希：`2a9e718fcc0d3ebc7e9973a8ce0c3c56c488cfb0`
- 时间：2026-03-18
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：feat
- 变更文件：
  - ChongzhenSim/js/systems/storySystem.js
  - ChongzhenSim/js/state.js
  - ChongzhenSim/css/components.css
- 玩法兼容与冲突取舍：
  - 新增“选中文本一键下划线标注”能力，仅作用于当前回合剧情文本，不影响原有剧情/抉择链路。
  - 新增可折叠“标注内容合集”，按时间倒序展示并附带回合维度与时间戳。
  - 标注数据接入全局 state 的 `storyHighlights`，沿用既有存档机制持久化。
- 自检结果：
  - Root：`cd ChongzhenSim && npm test` 通过（98/98）
  - Server：`cd ChongzhenSim/server && npm test -- --runInBand` 通过（49/49）

#### 6.1.9 c4f220b · feat(story): add delete buttons and restore highlights in history turns
- 全哈希：`c4f220bef4173ce3b64d3454d039d3f0da3bd09c`
- 时间：2026-03-18
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：feat
- 变更文件：
  - ChongzhenSim/js/systems/storySystem.js
  - ChongzhenSim/css/components.css
  - commit.md
- 玩法兼容与冲突取舍：
  - 标注合集面板中每条记录新增"删除"按钮，支持单条删除。
  - 合集底部新增"清空全部标注"按钮，一键清空所有记录。
  - 历史回合文本现在也支持按已存标注自动回显下划线，与当前回合行为一致。
  - 未改动存储机制和数据结构，删除操作直接写回 state。
- 自检结果：
  - Root：`cd ChongzhenSim && npm test` 通过（98/98）
  - Server：`cd ChongzhenSim/server && npm test -- --runInBand` 通过（49/49）

#### 6.1.10 d681121 · fix(story): normalize LLM appointments array to dict, fix [object Object] display
- 全哈希：`d6811217b8a041c73a9fc2f577b9d7ceafbe603a`
- 时间：2026-03-18
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/js/api/llmStory.js
  - ChongzhenSim/js/systems/storySystem.js
  - commit.md
- 问题描述：
  - LLM 有时将 `lastChoiceEffects.appointments` 返回为对象数组格式（`[{positionId,characterId}]`）而非字典格式（`{positionId: characterId}`）。
  - `Object.entries()` 在数组上迭代时，键为数组下标（0/1/2/3），值为对象本体，导致面板显示"任命 [object Object] → 0"。
- 修复策略：
  - 在 `llmStory.js` 新增 `normalizeAppointmentsMap` 和 `normalizeLastChoiceEffects` 函数，在数据源头将两种格式统一转为字典，非法条目直接跳过。
  - 在 `storySystem.js` 的 `renderDeltaCard` 和 `applyEffects` 两处消费点增加 `!Array.isArray` 防御判断，确保双重保险。
- 自检结果：
  - Root：`cd ChongzhenSim && npm test` 通过（98/98）
  - Server：`cd ChongzhenSim/server && npm test -- --runInBand` 通过（49/49）

#### 6.1.11 5a54cfc · fix(story): include season/weather context and prevent duplicate opposite delta cards
- 全哈希：`5a54cfc6d378b5d4d7f95c1360d89af61468f774`
- 时间：2026-03-18
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/server/index.js
  - ChongzhenSim/server/index.test.js
  - ChongzhenSim/js/api/llmStory.js
  - ChongzhenSim/js/systems/storySystem.js
- 问题描述：
  - 每回合剧情头部偶发缺失季节/天气，提示词中也未明确携带该上下文。
  - 自拟诏书回合在 LLM 修正后重复渲染了“本轮推演数值变动”，出现一正一负两张卡。
- 修复策略：
  - 服务端 buildUserMessage 改为使用 `currentYear/currentMonth/weather` 并补充季节推导，明确要求 header 返回 `time/season/weather`。
  - 前端 `llmStory.js` 对 header 增加 season/weather 兜底，确保每回合显示完整。
  - `storySystem.js` 在自拟诏书修正阶段替换最后一张 delta 卡，不再追加第二张冲突卡片。
- 自检结果：
  - Root：`cd ChongzhenSim && npm test` 通过（98/98）
  - Server：`cd ChongzhenSim/server && npm test -- --runInBand` 通过（49/49）

#### 6.1.12 b6536e3 · fix(story): harden effect validation and stabilize custom-edict corrections
- 全哈希：`b6536e38f898535c72aacfe5945392884dd4b84f`
- 时间：2026-03-19
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/js/api/validators.js
  - ChongzhenSim/js/api/llmStory.js
  - ChongzhenSim/js/systems/turnSystem.js
  - ChongzhenSim/js/systems/storySystem.js
  - ChongzhenSim/js/api/validators.test.js
  - ChongzhenSim/server/index.js
- 问题描述：
  - 每轮推理在自拟诏书链路中存在“先估算后修正”的正负翻转观感。
  - LLM 返回的 effects 缺乏统一限幅，偶发出现不合理大幅波动。
- 修复策略：
  - 新增 `sanitizeStoryEffects` 统一限幅并接入 choice effects / lastChoiceEffects / 入账前守卫。
  - LLM 模式下自拟诏书不再先行估算入账，减少反向冲销。
  - 增加 custom-edict 翻转审计日志，并新增 `validators.test.js` 覆盖限幅逻辑。
  - 同步精简服务端 `buildUserMessage` 重复文案拼接，保持语义一致。
- 自检结果：
  - Root：`cd ChongzhenSim && npm test` 通过（100/100）
  - Server：`cd ChongzhenSim/server && npm test -- --runInBand` 通过（49/49）

#### 6.1.13 44d5fdd · feat(gameplay): align day1 roster, persist current turn story, auto-quarter appointments
- 全哈希：`44d5fdd526c35f7831d2850733f244780d17dfe4`
- 时间：2026-03-19
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：feat
- 变更文件：
  - ChongzhenSim/js/main.js
  - ChongzhenSim/js/state.js
  - ChongzhenSim/js/systems/storySystem.js
  - ChongzhenSim/js/systems/turnSystem.js
  - ChongzhenSim/js/api/validators.js
  - ChongzhenSim/js/api/validators.test.js
  - ChongzhenSim/js/api/llmStory.js
  - ChongzhenSim/js/ui/courtView.js
  - ChongzhenSim/css/components.css
  - ChongzhenSim/server/index.js
  - ChongzhenSim/server/index.test.js
- 问题描述：
  - day1 剧情中的官员与朝堂默认任命体系存在不一致感知。
  - 未进行任何操作时刷新页面会触发当前回合剧情重新生成。
  - 对话文本偶发出现“中文姓名(english_id)”样式，影响沉浸感。
  - 季度流程缺少对空缺官职的自动补官闭环。
- 修复策略：
  - 预加载阶段在无存档任命时改为按 `positions.json` 的 `defaultHolder` 初始化任命，统一 day1 与朝堂默认名单基准。
  - 新增 `currentStoryTurn` 持久化当前回合剧情快照，刷新后优先复用，不再无操作重生剧情。
  - 在文本归一化阶段清理“中文名后英文括号后缀”，并增强字符串数值解析。
  - 新增季度自动补官：季度月自动为空缺官职从在世候选中按忠诚优先补位，并写入系统新闻。
  - 同步优化朝堂部门分组 UI 结构与视觉层次。
- 自检结果：
  - Root：`cd ChongzhenSim && npm test` 通过（103/103）
  - Server：`cd ChongzhenSim/server && npm test -- --runInBand` 通过（50/50）

每次执行 `git commit` 后，按以下模板在“6. 增量提交记录”末尾追加一条：

```markdown
#### 6.x.<序号> <short-hash> · <commit subject>
- 全哈希：`<full-hash>`
- 时间：<YYYY-MM-DD>
- 分支：<branch-name>
- 作者：<author>
- 类型：<feat/fix/refactor/docs/chore/test/merge>
- 变更文件：
  - <path1>
  - <path2>
- 玩法兼容与冲突取舍：
  - <保留了哪些主链逻辑>
  - <吸收了哪些新模块能力>
- 自检结果：
  - Root：<npm --prefix ChongzhenSim test --silent 结果>
  - Server：<npm --prefix ChongzhenSim/server test --silent 结果>
```

执行规范：
- 只追加，不覆盖旧记录。
- 如果是 merge commit，`变更文件` 可写“由 merge 产生，见对应 diff”。
- 若本次未执行测试，明确标注“未执行 + 原因”。

#### 6.1.14 86d898a · feat(court-ui): compact department blocks and move minister/faction to modals
- 全哈希：86d898ae3af1cf36a671f7c6a34b6bb4792cba5f
- 时间：2026-03-19
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：feat
- 变更文件：
  - ChongzhenSim/js/ui/courtView.js
  - ChongzhenSim/css/components.css
- 玩法兼容与冲突取舍：
  - 缩窄朝堂部门色块并优化标题层次，减少部门区域视觉压迫感。
  - 群臣列表与派系改为按钮触发弹窗展示，缓解朝堂部门过多导致的主页面拥挤。
  - 朝堂界面统一清理“中文名后英文括号后缀”，并保持既有聊天、任命与详情交互链路。
- 自检结果：
  - Root：cd ChongzhenSim && npm test -- --run 通过（103/103）
  - Server：cd ChongzhenSim/server && npm test -- --runInBand 通过（50/50）

#### 6.1.15 f7f3e40 · feat(court-ui): polish portrait court interactions and compact mobile layout
- 全哈希：f7f3e408533a132487d1f5bbfcfd01a87a3c5a9d
- 时间：2026-03-19
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：feat
- 变更文件：
  - ChongzhenSim/js/ui/courtView.js
  - ChongzhenSim/css/components.css
  - ChongzhenSim/css/layout.css
  - commit.md
- 玩法兼容与冲突取舍：
  - 朝堂部门支持竖屏单栏折叠与左右滑切，补充“首次出现后自动消失”的顶部微提示条。
  - 提示条改为 absolute 叠层并采用二段生命周期（淡出后 display:none），减少布局回流与层级残留。
  - 新增 <=375px 极致小屏模式，压缩边距与字号，降低滚动负担并保留触控可用性。
- 自检结果：
  - Root：未执行（本次仅 UI/交互样式迭代，按需可补测）
  - Server：未执行（本次未改动服务端）

#### 6.1.16 9b821d3 · fix(story): support mobile highlight selection and custom annotation input
- 全哈希：9b821d39206be6e5d552fa26bb7a515eba28558a
- 时间：2026-03-19
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/js/systems/storySystem.js
  - ChongzhenSim/css/modules/edict.css
- 玩法兼容与冲突取舍：
  - 标注逻辑增加“最近有效选区缓存”，修复手机端点按按钮后选区丢失导致无法标注的问题。
  - 标注合集新增“自定义标注”入口，支持弹窗输入并保存到既有 `storyHighlights` 状态链路。
  - 样式改动遵循 CSS 重构后的模块结构，仅在 `modules/edict.css` 内补充剧情标注相关规则，避免跨模块耦合。
- 自检结果：
  - Root：cd ChongzhenSim && npm test 通过（103/103）
  - Server：未单独执行（本次未改动服务端逻辑）

#### 6.1.17 f2f2409 · fix(goal): ensure goal panel opens and align styles with modular css
- 全哈希：`f2f240926365f0b9496ab6e35ddb35bc103ee27b`
- 时间：2026-03-19
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/js/ui/goalPanel.js
  - ChongzhenSim/css/components/common.css
- 玩法兼容与冲突取舍：
  - 目标入口点击后统一打开目标面板，空目标场景改为可见空态提示，避免“点击无反馈”。
  - 目标面板样式收敛到 `components/common.css`，保持现有模块化 CSS 结构一致性。
  - 不改动既有目标追踪/完成判定逻辑，仅修复可达性与展示层。
- 自检结果：
  - Root：cd ChongzhenSim && npm test 通过（103/103）
  - Server：未单独执行（本次未改动服务端逻辑）

#### 6.1.18 770fc05 · fix(hostile): preserve defeated forces visibility and enforce storyline closure
- 全哈希：770fc05f5b7778263c0fcb812aaf55d3c193f211
- 时间：2026-03-21
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/js/systems/coreGameplaySystem.js
  - ChongzhenSim/js/ui/nationView.js
- 玩法兼容与冲突取舍：
  - 修复国家面板敌对势力显示旧字段抢权问题，统一以 hostileForces 为单一事实来源。
  - 敌对势力灭亡后保留“已灭亡”可见卡片，并显式提示“相关故事线已闭锁”。
  - 增加 externalPowers 旧存档兼容桥接：初始化阶段自动映射势力值并补齐 closedStorylines，避免历史存档闭锁失效。
- 自检结果：
  - Root：cd ChongzhenSim && npm test -- --run 通过（103/103）
  - Server：未单独执行（本次未改动服务端逻辑）

#### 6.1.19 5c4dc27 · fix(gameplay): restore province evolution and support hostile rebound on failed strikes
- 全哈希：5c4dc271b84d0ee2a2bc372c4e235fbe816c151a
- 时间：2026-03-21
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/js/main.js
  - ChongzhenSim/js/systems/coreGameplaySystem.js
- 玩法兼容与冲突取舍：
  - 修复省份数据被预加载覆盖导致“各省数据不变化”的问题，保留存档演化值并引入基准字段用于稳定重算。
  - 在核心回合结算中恢复各省动态演化（税收/粮储/兵源/民心/贪腐/天灾）随国势联动更新。
  - 军事开拓新增“打击失败”分支：当推理文本或数值表明失利时，敌对势力值适量回升，并同步边患与民心反馈。
- 自检结果：
  - Root：cd ChongzhenSim && npm test -- --run 通过（103/103）
  - Server：未单独执行（本次未改动服务端逻辑）

#### 6.1.20 25d4910 · feat(court): switch to year-end vacancy reminder and mark deceased ministers
- 全哈希：25d4910d35818afd3e33ab45ed4f634a4d05165b
- 时间：2026-03-21
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：feat
- 变更文件：
  - ChongzhenSim/js/systems/turnSystem.js
  - ChongzhenSim/js/ui/courtView.js
  - ChongzhenSim/css/modules/court.css
- 玩法兼容与冲突取舍：
  - 将季度自动补官改为年末提醒补官，保留空缺治理权给玩家，不再由系统自动任命。
  - 任命候选与按人调岗入口统一增加生死校验，已故人物不可授官，避免状态冲突。

#### 6.1.21 429f549 · fix(court-chat): enforce alive roster context and mandatory per-turn delta panel
- 全哈希：`429f54987b67990caa71f990045f755954e04b99`
- 时间：2026-03-22
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/js/api/requestContext.js
  - ChongzhenSim/js/api/validators.js
  - ChongzhenSim/js/api/validators.test.js
  - ChongzhenSim/js/ui/courtView.js
  - ChongzhenSim/server/index.js
  - ChongzhenSim/server/index.test.js
  - ChongzhenSim/server/config.json
- 玩法兼容与冲突取舍：
  - 对话推理前注入“在任且在世/在世未任/已故”朝堂快照，并阻断已故大臣议事，减少已死或已离任角色错配复现。
  - 对话返回支持 appointments/effects 并统一按国家数值处理链路落地，朝堂聊天区强制展示“本轮对话数值变化”并与国家界面 state 对齐。
  - 服务端新增已故姓名后处理过滤（替换为“旧臣”），作为提示词约束之外的硬兜底。
- 自检结果：
  - Root：`cd ChongzhenSim && npm test` 通过（110/110）
  - Server：`cd ChongzhenSim/server && npm test` 通过（51/51）
  - 群臣列表新增已故标签与死亡态样式，同时延后自然死亡推进节奏以降低早期角色流失。
- 自检结果：
  - Root：cd ChongzhenSim && npm test -- --run 通过（103/103）
  - Server：未单独执行（本次未改动服务端逻辑）

#### 6.1.22 7389764 · fix(edict): enforce roster constraints and apply turn effects on all choices
- 全哈希：`7389764e45664a09b4022452e518dddc57dc4353`
- 时间：2026-03-22
- 分支：my-feature-branch
- 作者：JINTIAN-LIU
- 类型：fix
- 变更文件：
  - ChongzhenSim/server/index.js
  - ChongzhenSim/server/index.test.js
  - ChongzhenSim/js/systems/storySystem.js
- 玩法兼容与冲突取舍：
  - 诏书推理上下文新增“在任且在世/在世未任/已故”快照约束，避免已故或未任角色在剧情中错配出现。
  - `lastChoiceEffects` 回填从“仅自拟诏书”扩展到“所有诏书选择”，保证每轮诏书推演数值与国家状态对齐。
  - 诏书效果中的任命在落地时增加已故过滤，阻止已故角色被重新任命。
- 自检结果：
  - Root：`cd ChongzhenSim && npm run test -- server/index.test.js js/api/validators.test.js` 通过（46/46）
  - Server：未单独执行（本次通过 Vitest 跑了 server/index.test.js）
