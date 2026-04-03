# 剩余未修问题交接文档

## 文档目的

这份文档用于给新线程提供完整上下文，避免因为缺少历史对话而误解问题范围。

当前仓库中，`子任务创建契约` 相关问题已经修复完成；下面列出的内容是 **仍未修复** 的问题，适合在新线程中继续处理。

已修复内容仅作说明，不属于本次待修清单：

- `zentao_create_child_task` 不再接收 `execution`
- 子任务改为从父任务详情解析真实 `execution`
- `storyId` 只有显式传入才会关联，不会从父任务继承
- 补 parent 时会保留已有 `story/module`，避免被 Web 编辑接口清空

## 待修问题总览

仍需修复的高价值问题一共有 4 组：

1. 安装命令与真实入口不一致，README 的推荐命令会把用户带进错误流程
2. 普通任务创建与项目任务列表依赖 `resolveExecutionId()`，空项目时会直接失效
3. 安装器对坏配置缺少真实校验，可能输出“安装成功”但实际运行失败
4. 默认日期使用 UTC 截断，本地时区在凌晨会写错一天

---

## 问题 1：README 推荐安装命令与真实入口不一致

### 现象

README 当前写法：

- 推荐命令：`npx zentao-mcp-server install`

但 `package.json` 中真实的 bin 配置是：

- `zentao-mcp-server` -> `./dist/index.js`
- `zentao-mcp-install` -> `./dist/installer.js`

也就是说：

- 用户执行 `npx zentao-mcp-server install` 时，实际启动的是 `dist/index.js`
- `dist/index.js` 是 MCP stdio server 入口，不是交互式安装器
- `src/index.ts` 也没有任何 `install` 子命令分支处理逻辑

### 代码位置

- [README.md](/Users/bibilabu/dev/projects/zentao-mcp-server/README.md#L5)
- [package.json](/Users/bibilabu/dev/projects/zentao-mcp-server/package.json#L12)
- [src/index.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/index.ts#L17)
- [src/installer.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/installer.ts#L1)

### 为什么这是 bug

这不是文案小问题，而是用户入口级 bug：

- README 明确推荐的命令无法进入安装流程
- 用户会被带进 stdio server，而不是客户端检测、配置录入、配置注入流程
- 对普通用户来说，表现就是“照 README 执行，但根本没有安装体验”

### 影响

- 一键安装功能对用户不可用
- README 的主路径失真
- 用户会误判项目不可用或安装器失效

### 建议修复方向

至少需要在以下方案里选一个：

1. 修改 README，改成真实可用命令，例如 `npx zentao-mcp-install`
2. 或者把 `zentao-mcp-server` 做成支持 `install` 子命令，内部转到安装器
3. 或者调整 bin 设计，让推荐命令和默认入口一致

### 验收标准

- README 推荐命令可以真实进入安装器
- 按 README 从零执行，能看到客户端检测和配置引导，而不是 stdio server
- README、bin 配置、运行行为三者一致

---

## 问题 2：普通任务创建与项目任务列表在空项目下失效

### 现象

当前普通任务链路有一个核心假设：

- 先通过 `/tasks?project={projectId}&limit=1` 查到一条现有任务
- 再从这条任务里读取 `execution`
- 用该 `execution` 去调用 `/executions/{executionId}/tasks`

对应逻辑在 `resolveExecutionId()` 中：

- 如果项目还没有任务，就无法反推出 execution
- 于是直接抛出异常：`无法解析项目 X 对应的执行 ID，该项目可能没有任务`

这会导致两个用户可见问题：

1. 对一个没有任何任务的新项目调用 `zentao_create_task`，无法创建第一条任务
2. 对一个没有任何任务的新项目调用 `zentao_list_project_tasks`，无法得到空列表，而是直接报错

### 代码位置

- [src/clients/zentao-client.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/clients/zentao-client.ts#L149)
- [src/clients/zentao-client.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/clients/zentao-client.ts#L190)
- [src/clients/zentao-client.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/clients/zentao-client.ts#L310)
- [src/tools/task-tools.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/tools/task-tools.ts#L12)
- [src/tools/task-tools.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/tools/task-tools.ts#L53)

### 为什么这是 bug

这不是边缘 case，而是创建第一条任务的基础能力缺失。

当前实现把“项目里已有任务”当成创建/列表能力的前提，这是不成立的：

- 新项目应该可以创建第一条任务
- 空项目的任务列表应该返回空数组，而不是异常

### 已知额外背景

此前为了修复子任务创建，已经实际探测过禅道 v1 API，发现：

- `/tasks?project=` 在某些项目上行为不稳定，甚至会返回不属于目标项目的任务
- 说明 `resolveExecutionId()` 依赖的反推路径本身就不可靠

因此这个问题不仅是“空项目报错”，还包括“现有反推 execution 方案本身不稳定”。

### 影响

- 普通任务创建能力不完整
- 空项目任务列表能力不完整
- execution 解析依赖了不可信的接口行为

### 建议修复方向

新线程需要重新设计 **普通任务** 的 execution 解析策略，不能继续依赖 `/tasks?project=`。

可考虑的方向：

1. 从项目维度查询真实 execution 列表，再选出可用 execution
2. 对空项目明确支持返回空列表
3. 对“创建第一条任务”设计稳定的 execution 发现路径

注意：不要直接照抄旧的 `resolveExecutionId()` 思路；这条路径已经被证明在部分项目上不可信。

### 验收标准

- 空项目调用 `zentao_list_project_tasks` 返回空列表
- 空项目调用 `zentao_create_task` 能成功创建第一条任务
- 不再依赖 `/tasks?project=` 作为 execution 的唯一来源

---

## 问题 3：安装器对坏配置缺少真实校验，会输出假成功

### 现象

当前安装器在检查配置时：

1. 先判断 `configExists()`
2. 只要文件存在，就调用 `readConfig()`
3. `readConfig()` 解析失败时直接返回 `null`
4. CLI 仍然会打印“找到现有配置”，然后继续走注册逻辑

更关键的是：

- `config-manager.ts` 里虽然有 `validateConfig()`，但实际上没有被调用
- 安装器没有复用主程序的 `zentaoConfigSchema`
- 也没有复用主程序的 `loadConfig()` 标准化与校验逻辑

这意味着：

- 坏 JSON
- 缺少必填字段
- 不合法的 `baseUrl`

都有可能在安装阶段被当成“已有配置”放过去，最后用户看到“安装完成”，但真正运行 server 才失败。

### 代码位置

- [src/installer/cli.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/installer/cli.ts#L49)
- [src/installer/config-manager.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/installer/config-manager.ts#L31)
- [src/installer/config-manager.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/installer/config-manager.ts#L72)
- [src/types/config.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/types/config.ts#L12)
- [src/config/load-config.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/config/load-config.ts#L16)

### 为什么这是 bug

这是一个典型的“安装阶段假成功”问题：

- 用户安装时看到绿色成功提示
- 但运行阶段才因为配置损坏失败
- 失败被推迟，定位成本变高
- 安装器本应承担的前置校验职责没有完成

### 影响

- 安装体验误导
- 坏配置不会被尽早发现
- 安装器和主程序的配置契约不一致

### 建议修复方向

这组问题建议整体处理，不要只补其中一行：

1. 安装器与主程序统一使用同一份配置类型和 schema
2. 安装器读取已有配置时必须做真实校验
3. 对非法配置要明确报错或重新引导录入，不能继续打印“成功”
4. 尽量复用 `loadConfig()` 或抽出共享配置处理逻辑

### 验收标准

- 坏 JSON 文件会在安装阶段直接失败
- 缺少必填字段会在安装阶段直接失败
- `baseUrl` 非法会在安装阶段直接失败
- 安装器与主程序使用同一套配置契约

---

## 问题 4：默认日期使用 UTC，凌晨会错一天

### 现象

当前默认日期逻辑：

- `resolveDefaultDate(value)` 在未传值时使用 `new Date().toISOString().slice(0, 10)`

这相当于：

- 先转成 UTC 时间
- 再截取日期部分

在东八区（例如 `Asia/Shanghai`）凌晨时段会出问题：

- 本地时间：`2026-04-03 00:30`
- UTC 时间：`2026-04-02 16:30`
- 最终默认值会变成 `2026-04-02`

影响范围：

- `zentao_create_task`
- `zentao_create_child_task`

它们都会把默认 `estStarted` / `deadline` 写成前一天。

### 代码位置

- [src/tools/task-tools.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/tools/task-tools.ts#L7)
- [src/tools/task-tools.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/tools/task-tools.ts#L71)
- [src/tools/task-tools.ts](/Users/bibilabu/dev/projects/zentao-mcp-server/src/tools/task-tools.ts#L104)

### 为什么这是 bug

用户看到的是“默认当天”，但实际写入的是 UTC 当天，不是本地当天。

只要用户在本地凌晨使用这些工具，就会得到错误日期。

### 影响

- 默认开始日期可能早一天
- 默认截止日期可能早一天
- 创建出的任务时间信息不符合用户直觉，也不符合工具描述

### 建议修复方向

默认日期必须按本地时区生成，而不是 UTC。

可选方向：

1. 手动按本地时区格式化 `YYYY-MM-DD`
2. 使用 `Intl.DateTimeFormat` 按本地时区输出

不要继续用 `toISOString().slice(0, 10)`。

### 验收标准

- 在本地凌晨执行创建工具时，默认日期仍然是本地当天
- 工具描述“默认当天”和真实写入行为一致

---

## 新线程建议执行顺序

建议新线程按下面顺序修：

1. 问题 3：安装器配置校验
2. 问题 1：安装命令入口一致性
3. 问题 4：默认日期本地时区
4. 问题 2：普通任务 execution 解析重构

原因：

- 问题 3 和问题 1 相对边界清晰，适合先收掉
- 问题 4 独立且容易验证
- 问题 2 最复杂，因为它涉及重新定义普通任务的 execution 发现策略

## 已完成验证说明

本线程中已经完成的实测，仅供新线程参考：

- 项目 `22`（调研和采购）中，父任务 `20558` 的真实上下文为 `project=22, execution=23`
- `/executions/22/tasks` 与 `/executions/23/tasks` 在只读查询上都能命中该父任务，存在别名行为
- 但写接口不能信任这种别名行为；此前已实测 `/executions/22/tasks` 写入不稳定
- 修复后的子任务链路已经验证：
  - 不传 `storyId` -> 最终 `story=0`
  - 传 `storyId=3744` -> 最终 `story=3744`
  - 两次都稳定落在 `project=22, execution=23`
  - 创建后均已删除

这部分说明的目的是提醒新线程：

- 旧的 `/tasks?project=` 和 project/execution 别名行为并不可靠
- 处理“普通任务创建”时，不要再简单依赖旧的反推 execution 逻辑
