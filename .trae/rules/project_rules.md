# AGENTS.md

面向 AI 编程助手的项目级指导文档（基于 GSD 框架）。

## 可用资源

`.planning/` 中的所有资源均可调用或引用：

### 智能助手（Agents）

| 助手 | 文件 | 用途 |
|------|------|---------|
| `@project-researcher` | `~/.gsd-source/agents/gsd-project-researcher.md` | 研究领域生态系统 |
| `@research-synthesizer` | `~/.gsd-source/agents/gsd-research-synthesizer.md` | 综合研究成果 |
| `@roadmapper` | `~/.gsd-source/agents/gsd-roadmapper.md` | 创建项目路线图 |
| `@planner` | `~/.gsd-source/agents/gsd-planner.md` | 创建阶段计划 |
| `@phase-researcher` | `~/.gsd-source/agents/gsd-phase-researcher.md` | 研究阶段实现方案 |
| `@plan-checker` | `~/.gsd-source/agents/gsd-plan-checker.md` | 验证计划是否达成目标 |
| `@executor` | `~/.gsd-source/agents/gsd-executor.md` | 执行阶段计划 |
| `@verifier` | `~/.gsd-source/agents/gsd-verifier.md` | 验证阶段完成情况 |
| `@debugger` | `~/.gsd-source/agents/gsd-debugger.md` | 系统化调试 |
| `@codebase-mapper` | `~/.gsd-source/agents/gsd-codebase-mapper.md` | 映射现有代码库 |
| `@integration-checker` | `~/.gsd-source/agents/gsd-integration-checker.md` | 验证跨阶段集成 |

### 工作流

通过 `/gsd:command` 触发：

| 工作流 | 文件 | 用途 |
|----------|------|---------|
| `/gsd:new-project` | `~/.gsd-source/commands/gsd/new-project.md` | 初始化新项目 |
| `/gsd:new-milestone` | `~/.gsd-source/commands/gsd/new-milestone.md` | 开始新里程碑 |
| `/gsd:discuss-phase` | `~/.gsd-source/commands/gsd/discuss-phase.md` | 收集阶段上下文 |
| `/gsd:plan-phase` | `~/.gsd-source/commands/gsd/plan-phase.md` | 创建阶段计划 |
| `/gsd:execute-phase` | `~/.gsd-source/commands/gsd/execute-phase.md` | 执行阶段计划 |
| `/gsd:verify-work` | `~/.gsd-source/commands/gsd/verify-work.md` | 验证交付物 |
| `/gsd:audit-milestone` | `~/.gsd-source/commands/gsd/audit-milestone.md` | 审计里程碑完成情况 |
| `/gsd:complete-milestone` | `~/.gsd-source/commands/gsd/complete-milestone.md` | 归档已完成的里程碑 |
| `/gsd:map-codebase` | `~/.gsd-source/commands/gsd/map-codebase.md` | 分析现有代码 |
| `/gsd:progress` | `~/.gsd-source/commands/gsd/progress.md` | 检查项目进度 |
| `/gsd:debug` | `~/.gsd-source/commands/gsd/debug.md` | 系统化调试 |
| `/gsd:health` | `~/.gsd-source/commands/gsd/health.md` | 诊断规划健康状况 |
| `/gsd:settings` | `~/.gsd-source/commands/gsd/settings.md` | 配置工作流偏好 |

### 参考文档

| 参考 | 文件 | 内容 |
|-----------|------|---------|
| 提问技巧 | `~/.gsd-source/references/questioning.md` | 深度提问技术 |
| UI 品牌 | `~/.gsd-source/references/ui-brand.md` | 输出视觉规范 |
| 模型配置 | `~/.gsd-source/references/model-profiles.md` | AI 模型选择 |
| 规划配置 | `~/.gsd-source/references/planning-config.md` | 配置选项 |
| Git 集成 | `~/.gsd-source/references/git-integration.md` | Git 工作流模式 |
| 测试驱动开发 | `~/.gsd-source/references/tdd.md` | 测试驱动开发 |
| 检查点 | `~/.gsd-source/references/checkpoints.md` | 检查点模式 |
| 验证策略 | `~/.gsd-source/references/verification-patterns.md` | 验证策略 |
