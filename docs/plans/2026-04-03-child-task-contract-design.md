# 子任务创建契约重构设计

## 背景

当前 `zentao_create_child_task` 公开入参要求调用方传入 `execution`，但实测表明该参数语义在禅道 v1 API 上并不稳定。

对项目 `22`（调研和采购）的只读与最小写入探测结果如下：

- 父任务 `20558` 稳定属于 `project=22, execution=23`
- `GET /api.php/v1/executions/22/tasks` 与 `GET /api.php/v1/executions/23/tasks` 都能查到该父任务
- `GET /api.php/v1/projects/22/executions` 返回空列表
- `GET /api.php/v1/tasks?project=22` 返回了不属于项目 `22` 的任务，不能作为 execution 反推依据
- `POST /api.php/v1/executions/23/tasks` 创建任务稳定，任务最终落在 `project=22, execution=23`
- `POST /api.php/v1/executions/22/tasks` 返回 `201`，但详情查询失败，列表回查不到，写入行为不稳定

由此可知，当前“由调用方传 execution，再由服务端猜测真实执行”的方案既误导调用方，也存在真实正确性风险。

## 目标

1. 子任务创建只依赖父任务，不再暴露 `execution`
2. 真实写入目标始终以父任务详情里的 `execution` 为准
3. `story` 不从父任务继承，只接受调用方显式传入的 `storyId`
4. README、类型定义、MCP tool 描述与实现保持一致

## 设计决策

### 1. 对外契约

`zentao_create_child_task` 入参调整为：

- 必填：`name`、`parent`
- 可选：`storyId`、`type`、`assignedTo`、`estStarted`、`deadline`、`estimate`、`desc`

删除 `execution` 入参。这是一次有意的 breaking change。

### 2. 创建链路

子任务创建流程统一改为：

1. 调用 `getTask(parent)` 获取父任务详情
2. 从父任务详情中读取真实 `execution`
3. 使用 `/api.php/v1/executions/{executionId}/tasks` 创建普通任务
4. 若调用方显式传入 `storyId`，则透传到创建 body 的 `story`
5. 通过现有 Web 编辑接口补写 `parent`
6. 再次查询任务详情，返回最终状态

### 3. story 处理规则

- 父任务通常仅承担组织作用，不代表需求归属
- 父任务上的 `story` 绝不自动继承给子任务
- 只有调用方显式传入 `storyId` 时，子任务才关联需求

### 4. 错误处理

- 父任务不存在：返回“父任务不存在或无法获取详情”
- 父任务缺少有效 `execution`：返回“父任务缺少可用 execution，无法创建子任务”
- 创建成功但补 parent 失败：返回包含 `taskId` 的明确错误，便于人工排查
- 不再使用 `/tasks?project=` 反推 execution

## 改动范围

- `src/types/zentao.ts`
- `src/clients/zentao-client.ts`
- `src/tools/task-tools.ts`
- `README.md`

## 验证方案

1. 运行 `npm run build`
2. 使用项目 `22` 与父任务 `20558` 做真实验证
3. 分别验证：
   - 不传 `storyId` 创建并删除临时子任务
   - 传 `storyId` 创建并删除临时子任务
4. 确认：
   - 子任务稳定落在 `execution=23`
   - `story` 仅在显式传入时存在
   - 父任务的 `story` 不会被自动继承
