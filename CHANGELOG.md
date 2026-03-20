# 版本更新日志 v1.2

## [v1.2.1] - 2026-03-20

### 🔒 安全加固

#### CORS 配置收紧
- 从 `origin: true`（允许任意来源）改为白名单模式
- 支持环境变量 `ALLOWED_ORIGINS` 配置允许的来源
- 默认允许 localhost:8080/3000/3002 开发端口

#### API 超时设置
- 为所有 LLM API 调用添加 60 秒超时
- 使用 `AbortController` 实现请求取消
- 防止请求无限挂起

### 🧹 代码去重

#### 新建共享模块
- 新增 `js/utils/sharedConstants.js` 统一管理共享常量
- `AVAILABLE_AVATAR_NAMES` - 大臣头像名称集合
- `PERCENT_KEYS` - 百分比数值键
- `NATION_LABELS` - 国家数值标签
- `INVERT_COLOR_KEYS` - 反色显示键
- `buildNameById()` / `buildIdByName()` - ID/名称映射构建函数

#### 消除重复代码
- 移除 `storySystem.js`、`courtView.js`、`storyRenderer.js` 中的重复常量定义
- 统一使用 `effectsProcessor.js` 的 `applyEffects` 函数
- 统一 `nameById` 构建逻辑

### 🧠 内存管理

#### 事件管理器
- 新增 `js/utils/eventManager.js` 统一管理事件监听器
- `EventManager` 类支持自动清理
- 使用 `AbortController` 管理事件监听器生命周期
- 统一管理 `setTimeout` / `setInterval`

### 🎨 UI 优化

#### Toast 通知组件
- 新增 `js/utils/toast.js` Toast 通知组件
- 替换所有 `alert()` 原生弹窗为友好的 Toast 提示
- 支持 success/error/warning/info 四种类型
- 新增 Toast 相关 CSS 样式

### 📁 文件变更

| 文件 | 变更类型 |
|------|----------|
| `js/utils/sharedConstants.js` | 新增 |
| `js/utils/eventManager.js` | 新增 |
| `js/utils/toast.js` | 新增 |
| `server/index.js` | 修改（安全加固） |
| `js/systems/storySystem.js` | 修改（代码去重） |
| `js/ui/courtView.js` | 修改（代码去重 + Toast） |
| `js/utils/storyRenderer.js` | 修改（代码去重） |
| `js/utils/effectsProcessor.js` | 修改（导入共享常量） |
| `js/api/llmStory.js` | 修改（使用共享函数） |
| `css/components/common.css` | 修改（新增 Toast 样式） |

### 🧪 测试覆盖

- 前端测试：103 个用例通过 ✅
- 后端测试：50 个用例通过 ✅

---

## [v1.2.0] - 2026-03-19

### 🎮 核心玩法更新

#### 月度/季度系统
- 玩法节奏从"日"改为"月"，引入季度结算机制
- 季度议题系统：每季度自动生成急/重/缓三类议题
- 季度自动补官：空缺官职自动从在世候选中按忠诚优先补位

#### 国策树系统
- 新增 50+ 国策选项
- 国策影响国家各项数值发展
- 数据驱动的国策配置

#### 敌对势力系统
- 敌对势力可被打击至灭亡
- 连续战事逻辑优化
- 省份动态规则外置

#### 皇帝成长系统
- 皇帝属性成长体系
- 属性影响决策效果

### 🖥️ 朝堂系统优化

#### 任命流程重构
- 任命面板从弹窗改为页内面板
- 面板定位到对应部门分组下方
- "选择 + 确认"两步操作，降低误触
- 候选信息改为纯文字（姓名/字号/派系/忠诚）

#### UI 布局优化
- 部门色块缩窄，减少视觉压迫
- 群臣列表与派系改为弹窗展示
- 支持 <=375px 极致小屏模式
- 竖屏单栏折叠与左右滑切

### 📖 剧情系统增强

#### 剧情标注功能
- 选中文本一键下划线标注
- 标注内容合集按时间倒序展示
- 支持单条删除和清空全部
- 历史回合标注自动回显

#### 效果验证优化
- 新增 `sanitizeStoryEffects` 统一限幅
- LLM 返回的 appointments 格式自动归一化
- 自拟诏书不再先行估算入账，减少反向冲销
- 季节/天气上下文完整传递

#### 剧情持久化
- 新增 `currentStoryTurn` 持久化当前回合剧情
- 刷新页面后优先复用，不再无操作重生剧情

### 🏗️ 代码架构重构

#### CSS 模块化
- `components.css` 拆分为多个模块文件
- `css/components/common.css` - 通用组件样式
- `css/modules/court.css` - 朝堂样式
- `css/modules/edict.css` - 诏书样式
- `css/modules/nation.css` - 国势样式

#### JS 模块化
- `js/modules/court/index.js` - 朝堂模块
- `js/modules/edict/index.js` - 诏书模块
- `js/modules/nation/index.js` - 国势模块

#### API 优化
- 新增 `httpClient.js` 公共 HTTP 请求模块
- 新增 `requestContext.js` 请求上下文构建
- 新增 `validators.js` 数据校验模块
- 减少重复代码，提升可维护性

### 📊 数据驱动

#### 配置外置
- `balanceConfig.json` - 平衡参数配置
- `provinceRules.json` - 省份动态规则
- 数据与逻辑分离，便于调整平衡

### 🐛 Bug 修复

- 修复朝堂任命点击无反应问题
- 修复头像缺失导致 404 噪音
- 修复 favicon 缺失 404
- 修复 LLM appointments 数组格式导致的 `[object Object]` 显示
- 修复自拟诏书修正后重复渲染 delta 卡
- 修复剧情头部偶发缺失季节/天气
- 清理"中文名后英文括号后缀"显示问题

### 🧪 测试覆盖

- 前端测试：103 个用例通过
- 后端测试：50 个用例通过
- 新增 `validators.test.js` 限幅逻辑测试

---

## [v1.0.0] - 2026-03-13

### 初始版本

- 项目基础骨架搭建
- 崇祯皇帝模拟器核心玩法
- 大臣系统与派系关系
- AI 剧情生成
- 前后端分离架构
