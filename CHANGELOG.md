# 版本更新日志 v1.2

## [v1.2] - 2026-03-20 ~ 2026-03-28

> 本版本更新汇总覆盖 2026-03-20 至 2026-03-28 的迭代内容。

### 🔒 安全与基础能力更新

#### CORS 与请求超时
- 服务端 CORS 从全开放改为白名单模式
- 支持通过 `ALLOWED_ORIGINS` 配置允许来源
- 为所有 LLM API 请求统一增加 60 秒超时与中止控制

#### 共享常量与事件管理
- 新增共享常量模块，统一头像名、百分比字段、国家数值标签等基础配置
- 新增事件管理器，统一清理事件监听、定时器与异步生命周期
- 继续消除剧情、朝堂、渲染层中的重复常量与重复逻辑

### 🎨 交互与界面体验

#### Toast 与前端反馈
- 新增 Toast 通知组件，逐步替代原生 `alert()`
- 支持 success、error、warning、info 四类提示
- 补充通用样式，减少打断式弹窗对流程的影响

### 🎮 困难模式增强

#### 开场链路与叙事约束
- 修复困难模式开场点击无响应问题，恢复独立故事时间线推进
- 执行约束从前端展示中拆分，改为作为 LLM 推理输入参与剧情生成
- 记忆锚点与执行约束形成完整约束链，减少剧情偏离和状态漂移

#### 动态决策与刚性回合处理
- 困难模式支持未知动态选项兜底，不再因未预设 choice 直接阻断流程
- 决策后可继续触发敌对势力结算、故事线闭锁与记忆锚点记录
- 自拟诏书可抽取自定义国策并纳入后续季度结算

### 🏛️ 科举与人事系统更新

#### 科举/武举候选扩充
- 扩充角色池，缓解大臣过少和死亡过快导致的后备不足
- 科举与武举默认可生成随机候选，提升中后期可持续性
- 任命流程继续按忠诚度及文武属性参与候选筛选

#### 官员任免与赐死识别
- 从诏书文本中统一提取任命、免职与赐死效果
- 新增赐死关键词近邻匹配，避免跨句误判
- 官员死亡后自动更新状态并关闭相关故事线

### 📊 数值与展示优化

#### 国势面板重构
- 困难模式新增“崇祯·大明国势”综合面板，合并展示国家、朝局与皇帝状态指标
- 统一困难模式财务单位显示，与经典模式保持一致
- 修复部分指标显示小数的问题，统一按整数展示

#### 诏书资源解析增强
- 支持从诏书中解析阿拉伯数字和中文数字金额/粮食数量
- 可识别收入与支出语义，自动推断国库、粮仓增减
- 避免困难模式与经典模式重复展示 delta 卡片

### 📖 剧情与状态持久化

#### 本地上下文与故事连续性
- 剧情上下文压缩后写入本地状态，提升长线叙事稳定性
- 已灭亡敌对势力对应故事线会被闭锁，避免后续叙事“复活”
- 修复 `hard_mode_day1_morning.json` 语法错误，确保困难模式首回合正常加载

### 🧹 仓库维护

#### 本地文档忽略规则
- 将困难模式设计文档、模式对比文档和本地科举功能笔记加入忽略规则
- 停止跟踪仅用于本地整理的 Markdown 文档，避免误入版本库

### 📁 文件变更

| 文件 | 变更类型 |
|------|----------|
| `server/index.js` | 修改（CORS 白名单、请求超时） |
| `ChongzhenSim/js/utils/sharedConstants.js` | 新增（共享常量） |
| `ChongzhenSim/js/utils/eventManager.js` | 新增（事件管理） |
| `ChongzhenSim/js/utils/toast.js` | 新增（Toast 提示） |
| `ChongzhenSim/js/rigid/engine.js` | 修改（动态决策兜底、困难模式回合处理） |
| `ChongzhenSim/js/rigid/memory.js` | 修改（执行约束与记忆锚点） |
| `ChongzhenSim/js/rigid/moduleComposer.js` | 修改（叙事结构精简） |
| `ChongzhenSim/js/systems/turnSystem.js` | 修改（刚性链路、人事/敌对势力/国策整合） |
| `ChongzhenSim/js/systems/storySystem.js` | 修改（资源解析、展示去重） |
| `ChongzhenSim/js/systems/kejuSystem.js` | 修改（随机候选默认开启） |
| `ChongzhenSim/js/utils/appointmentEffects.js` | 修改（任免/赐死统一提取） |
| `ChongzhenSim/js/utils/displayStateMetrics.js` | 修改（困难模式指标与单位统一） |
| `ChongzhenSim/js/utils/storyRenderer.js` | 修改（渲染层去重） |
| `ChongzhenSim/js/utils/effectsProcessor.js` | 修改（共享逻辑复用） |
| `ChongzhenSim/js/api/llmStory.js` | 修改（请求与共享逻辑优化） |
| `ChongzhenSim/js/ui/nationView.js` | 修改（综合国势面板） |
| `ChongzhenSim/js/ui/courtView.js` | 修改（交互与流程优化） |
| `ChongzhenSim/data/story/hard_mode_day1_morning.json` | 修改（修复 JSON 语法） |
| `ChongzhenSim/css/components/common.css` | 修改（Toast 样式） |
| `.gitignore` | 修改（忽略本地 Markdown 文档） |

### 🧪 测试覆盖

- 前端测试：103 个用例通过 ✅
- 后端测试：50 个用例通过 ✅
- 更新 `engine.test.js`，覆盖动态故事选项兜底
- 更新 `kejuSystem.test.js`，覆盖随机候选默认行为
- 更新 `turnSystem.pipeline.test.js`，覆盖资源估算、敌对势力处理、自定义国策与任免效果联动
- 更新 `appointmentEffects.test.js`，覆盖赐死与组合效果提取

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
