<h1><strong>AI 历史模拟器</strong></h1>

<div align="center">
  <img src="https://img.shields.io/badge/powered%20by-Funloom%20AI-4285F4.svg" alt="Powered by Funloom AI">
  <img src="https://img.shields.io/badge/type-AI%E6%96%87%E6%B8%B8%E5%88%9B%E4%BD%9C-FF6B6B.svg" alt="AI文游创作">
  <img src="https://img.shields.io/badge/state-开发中-4CAF50.svg" alt="开发中">
  <img src="https://img.shields.io/badge/tests-56%20passed-brightgreen.svg" alt="Tests">
</div>

本项目由 **Funloom AI** 强力支持，基于 Funloom 推出的 AI 文游创作工具开发实现，让历史模拟类文字游戏的创作与体验更具沉浸感和趣味性。

🔗 **Funloom AI 官方地址**：https://www.funloom.ai/

---

## 📖 项目介绍

一款由 AI 驱动的历史模拟器，打破传统文字游戏的剧情与交互壁垒，实现不同历史背景下的沉浸式模拟体验。

- 不同历史背景的模拟项目独立存放在子文件夹中
- 每个子项目可通过自身对应的 README 文件完成个性化配置
- 轻量配置即可快速启动不同朝代、不同地域的历史模拟场景

---

## 💡 核心设计思路

本项目的核心设计围绕**沉浸感**与**交互性**打造，让历史模拟不再是单一的剧情推进：

### 主线剧情 ↔ 角色聊天 双向连通

主线剧情的发展会影响角色的对话走向与态度，角色聊天中的选择和互动也会反向推动主线剧情分支变化，二者相互影响、动态联动。

### 数值系统可视化国家进程

搭配完善的数值体系（如经济、军事、民生、文化等），实时显示模拟过程中的国家/势力发展进程，让历史走向有数据可依。

### AI 赋能创作与体验

基于 Funloom AI 文游创作工具的能力，降低游戏开发门槛，同时让 AI 为模拟过程提供动态的剧情、对话与事件生成，让每一次模拟都有不同体验。

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | 原生 JavaScript ES6+ | 无框架依赖，模块化设计 |
| **后端** | Node.js + Express | LLM API 代理服务 |
| **LLM** |  | 可配置其他 OpenAI 兼容 API |
| **数据** | 静态 JSON | 无数据库，轻量部署 |
| **存储** | localStorage | 存档持久化 |
| **构建** | Vite | 现代化构建工具 |
| **测试** | Jest + Vitest | 前后端测试覆盖 |

---

## 📂 项目结构

```
HistorySimAI/
├── ChongzhenSim/              # 崇祯皇帝模拟器
│   ├── index.html             # 前端入口
│   ├── js/
│   │   ├── main.js            # 应用启动
│   │   ├── state.js           # 全局状态管理
│   │   ├── router.js          # 视图路由
│   │   ├── api/               # LLM API 封装
│   │   │   ├── llmStory.js    # 剧情生成 API
│   │   │   └── ministerChat.js# 大臣聊天 API
│   │   ├── systems/           # 核心系统
│   │   │   ├── storySystem.js # 剧情系统
│   │   │   ├── turnSystem.js  # 回合系统
│   │   │   ├── courtSystem.js # 朝堂系统
│   │   │   └── nationSystem.js# 国势系统
│   │   ├── ui/                # UI 视图组件
│   │   └── utils/             # 工具函数
│   │       ├── effectsProcessor.js  # 效果计算
│   │       ├── storyParser.js       # 剧情解析
│   │       ├── storyRenderer.js     # 剧情渲染
│   │       └── storyUI.js           # UI 组件
│   ├── server/                # Node.js 后端
│   │   ├── index.js           # Express 服务
│   │   ├── config.json        # LLM 配置（需创建）
│   │   ├── config.example.json# 配置模板
│   │   └── schemaValidator.js # JSON Schema 验证
│   ├── data/                  # 静态数据
│   │   ├── characters.json    # 大臣角色
│   │   ├── config.json        # 前端配置
│   │   ├── factions.json      # 派系关系
│   │   └── story/             # 本地剧情
│   ├── css/                   # 样式文件
│   └── assets/                # 大臣头像
├── .gitignore
├── LICENSE
└── README.md
```


## ⚙️ 配置说明

### 后端配置 (`server/config.json`)

| 字段 | 说明 | 示例 |
|------|------|------|
| `LLM_API_KEY` | 大模型 API 密钥（必填） | `your-api-key` |
| `LLM_API_BASE` | API 网关地址 | ` |
| `PORT` | 服务端口 | `3002` |

### 前端配置 (`data/config.json`)

| 字段 | 说明 | 可选值 |
|------|------|--------|
| `storyMode` | 剧情模式 | `llm`（AI生成）/ `json`（本地） |
| `apiBase` | 后端地址 | `http://localhost:3002` |
| `totalDays` | 游戏总天数 | `30` |
| `autoSave` | 自动存档 | `true` / `false` |

---

## 启动方式

### 一条命令启动前后端

进入 [ChongzhenSim](ChongzhenSim) 目录后执行：

```bash
npm run start
```

该命令会同时启动：

- 前端 Vite 开发服务：`http://localhost:5173`
- 后端 Express 服务：`http://localhost:3002`

### 分开启动

如果需要单独启动，也可以使用：

```bash
npm run start:frontend
npm run start:server
```

启动前建议先分别安装依赖：

```bash
cd ChongzhenSim
npm install
cd server
npm install
```

---

## 🎮 游戏特性

### 崇祯皇帝模拟器

- **时间系统**：早朝 → 午后 → 夜间 → 次日循环
- **国家数值**：国库、粮储、军力、民心、边患、天灾、贪腐
- **大臣系统**：10 位历史大臣，各有派系和忠诚度
- **自拟诏书**：玩家可自由撰写决策内容
- **AI 剧情生成**：基于当前状态动态生成剧情

### 大臣角色

| 姓名 | 官职 | 派系 |
|------|------|------|
| 毕自严 | 户部尚书 | 东林党 |
| 梁廷栋 | 兵部右侍郎 | 中立 |
| 温体仁 | 内阁首辅 | 阉党余部 |
| 孙承宗 | 兵部尚书 | 东林党 |
| 曹化淳 | 司礼监秉笔太监 | 帝党 |
| 洪承畴 | 陕西三边总督 | 军事将领 |
| 王永光 | 吏部尚书 | 中立 |
| 林钎 | 礼部尚书 | 中立 |
| 韩继思 | 刑部尚书 | 中立 |
| 张凤翔 | 工部尚书 | 中立 |

---

## 🤝 欢迎共创

本项目开放共创，无论是对历史背景的补充、剧情的优化、数值系统的调整，还是新历史模拟场景的开发，都欢迎各位开发者/爱好者参与！

### 参与方式

1. Fork 本仓库
2. 基于开发规范修改/新增内容
3. 提交 Pull Request，经审核后合并

### 开发规范

- 代码风格：遵循现有代码规范
- 测试要求：新增功能需添加测试
- 提交信息：使用语义化提交信息

---

## ⭐ 鼓励与支持

如果这个 AI 历史模拟器项目让你觉得有趣，或者对你的文游创作有帮助，不妨给项目点一个小星星⭐，你的支持是我们持续开发和优化的最大动力！

---

<div align="center">
  <sub>本项目由 Funloom AI 提供AI技术支持 | 让创意无需等待技术实现</sub>
</div>
