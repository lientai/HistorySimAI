## 崇祯皇帝模拟器 · LLM 接口与配置说明

本说明文档帮助你在本地或服务器上正确配置大模型代理和前端参数，特别是和 `LoveShow` 项目共用一台服务器时如何区分接口路径。

目录：

- [项目结构概览](#项目结构概览)
- [后端 LLM 代理配置（server/config.json）](#后端-llm-代理配置serverconfigjson)
- [前端全局配置（data/config.json）](#前端全局配置dataconfigjson)
- [接口路径说明](#接口路径说明)
- [本地启动步骤](#本地启动步骤)
- [与 LoveShow 同机部署建议](#与-loveshow-同机部署建议)

---

### 项目结构概览

关键目录（相对于 `ChongzhenSim/` 根目录）：

- `index.html`：前端入口页面
- `data/config.json`：前端全局配置（是否走 LLM、后端地址等）
- `data/story/*.json`：本地剧情 JSON（在非 LLM 模式下使用）
- `js/api/llmStory.js`：诏书剧情 LLM 请求封装
- `js/api/ministerChat.js`：朝堂大臣聊天 LLM 请求封装
- `server/index.js`：Node.js LLM 代理服务
- `server/config.json`：后端 LLM 代理配置

---

### 后端 LLM 代理配置（server/config.json）

文件路径：`server/config.json`。示例：

```json
{
  "LLM_API_KEY": "在这里填你的LLM密钥",
  "LLM_API_BASE": "https://open.bigmodel.cn/api/paas/v4",
  "LLM_MODEL": "glm-4-flash",
  "LLM_CHAT_MODEL": "glm-4-flash",
  "PORT": 3002
}
```

字段说明：

- **LLM_API_KEY**：大模型服务提供的 API Key，必填。
- **LLM_API_BASE**：大模型 HTTP 网关基础地址，例如：
  - `https://open.bigmodel.cn/api/paas/v4`（智谱AI）
  - `https://api.openai.com/v1`（OpenAI）
  - 末尾不要加 `/`。
- **LLM_MODEL**：用来生成诏书剧情的模型名称。
- **LLM_CHAT_MODEL**：用来生成大臣聊天回复的模型名称。
- **PORT**：本代理服务监听端口，默认 `3002`。

启动后端：

```bash
cd ChongzhenSim/server
npm install     # 首次需要
npm start
```

成功后终端会看到类似日志：

```text
ChongzhenSim proxy listening on http://localhost:3002 (routes: /api/chongzhen/story, /api/chongzhen/ministerChat)
```

如果未配置 `LLM_API_KEY`，日志会有警告，并且接口返回 500。

---

### 前端全局配置（data/config.json）

文件路径：`data/config.json`。示例：

```json
{
  "storyMode": "llm",
  "apiBase": "http://localhost:3002",
  "loyaltyMax": 100,
  "phaseLabels": {
    "morning": "早朝",
    "afternoon": "午后",
    "evening": "夜间"
  }
}
```

关键字段：

- **storyMode**
  - `"llm"`：使用大模型生成剧情。
  - `"json"`：只使用本地 `data/story/*.json` 剧情，不访问后端。
- **apiBase**
  - 指向 `server/index.js` 启动的地址（不带末尾 `/`），例如：
  - `"http://localhost:3002"`（本地）  
  - 或你的服务器地址：`"https://your-domain.com/chongzhen-api"`（按实际反向代理配置）。
- **loyaltyMax / phaseLabels**
  - 分别控制忠诚度上限和 UI 中“早朝 / 午后 / 夜间”的展示文字。

前端在运行时会：

- 在诏书 Tab 中，`js/api/llmStory.js` 读取 `apiBase` 和 `storyMode`，在 `"llm"` 模式下调用后端。
- 在朝堂聊天中，`js/api/ministerChat.js` 同样读取 `apiBase` 并调用后端。

---

### 接口路径说明

为避免与 `LoveShow` 项目冲突，ChongzhenSim 使用了**独立的路径前缀**：

- 剧情接口（诏书）：
  - **后端**：`POST /api/chongzhen/story`（定义于 `server/index.js`）
  - **前端**：`js/api/llmStory.js` 中：
    ```js
    const url = `${apiBase}/api/chongzhen/story`;
    ```
- 朝堂大臣聊天接口：
  - **后端**：`POST /api/chongzhen/ministerChat`
  - **前端**：`js/api/ministerChat.js` 中：
    ```js
    const url = `${apiBase}/api/chongzhen/ministerChat`;
    ```

LoveShow 仍然使用自己的：

- `/api/story`
- `/api/guestChat`

这样两套游戏可以共用一台服务器、甚至共用一套 Node 服务，只要路由挂载得当，就不会冲突。

---

### 本地启动步骤汇总

1. **配置后端 LLM 代理**
   - 编辑 `server/config.json`，填入：
     - `LLM_API_KEY`
     - `LLM_API_BASE`
     - 模型名称 `LLM_MODEL` / `LLM_CHAT_MODEL`
2. **启动后端**
   - 在 `ChongzhenSim/server` 目录执行：
     ```bash
     npm install   # 首次
     npm start
     ```
3. **配置前端**
   - 编辑 `data/config.json`：
     - `"storyMode": "llm"`
     - `"apiBase": "http://localhost:3002"`（或你的实际地址）
4. **起一个静态文件服务器打开前端**
   - 示例（在 `ChongzhenSim` 目录下）：
     ```bash
     npx http-server . -p 8080
     ```
   - 浏览器访问：`http://localhost:8080/index.html`

---

### 与 LoveShow 同机部署建议

如果同一台机器同时部署 `LoveShow` 和 `ChongzhenSim` 的 LLM 代理，有两种常见方式：

1. **两个独立 Node 进程**
   - LoveShow：端口 `3000`，接口 `/api/story`、`/api/guestChat`
   - ChongzhenSim：端口 `3001`，接口 `/api/chongzhen/story`、`/api/chongzhen/ministerChat`
   - 对应前端分别设置各自的 `apiBase`。

2. **单进程挂两组路由（进阶用法）**
   - 在一个总的 Express 应用里：
     - `app.use("/api", loveShowRouter);`
     - `app.use("/api", chongzhenRouter);`  
   - 由于 ChongzhenSim 内部路由已使用 `/chongzhen/...` 前缀，不会与 LoveShow 的 `/api/story` 等路径冲突。

无论哪种方式，只需确保：

- LoveShow 前端的 `apiBase` 指向 LoveShow 代理；
- ChongzhenSim 前端的 `apiBase` 指向 ChongzhenSim 代理；
- 即可在同一台服务器上并行运行两款游戏的大模型功能。

