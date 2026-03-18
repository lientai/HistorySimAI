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

#### 6.1.10 974a3de · fix(story): normalize LLM appointments array to dict, fix [object Object] display
- 全哈希：`974a3dec964f655365cc9d8d21a6bcc5166e7824`
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
