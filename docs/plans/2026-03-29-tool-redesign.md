# 禅道 MCP Server Tool 重新设计

## 背景

当前 tool 设计按 API 端点一一映射，导致"列出我的任务"这种常见需求需要模型编排多次调用（项目列表→执行列表→任务列表），加上禅道 API 返回字段极其膨胀，直接打爆上下文。

## 设计目标

1. 每个用户场景 1 次 tool call 完成
2. 返回值只保留 LLM 需要的关键字段
3. 覆盖 10 个核心场景

## API 端点

| 用途 | 端点 |
|------|------|
| 产品列表 | `GET /v1/products` |
| 项目列表 | `GET /v1/projects` |
| 需求列表 | `GET /v1/products/{id}/stories` |
| 任务列表 | `GET /v1/tasks?projectID={id}&status={status}` |
| Bug 列表 | `GET /v1/bugs?product={id}&status={status}` |
| 用户列表 | `GET /v1/users` 或 `/v2/users` |
| 创建任务 | `POST /v1/tasks` |

## Tool 清单

| Tool | 返回字段 |
|------|---------|
| `zentao_ping` | ok, user.realname |
| `zentao_list_products` | id, name |
| `zentao_list_projects` | id, name |
| `zentao_list_stories` | id, title, status, pri, stage, assignedTo.realname, planTitle |
| `zentao_list_project_tasks` | id, name, status, pri, assignedTo.realname, deadline, estimate, left, consumed |
| `zentao_get_task` | 列表字段 + desc(截断200字去HTML), openedBy.realname, finishedBy, children(仅id+name+status) |
| `zentao_create_task` | 创建后返回裁剪后的任务对象 |
| `zentao_create_child_task` | 同上 |
| `zentao_add_task_comment` | 操作结果 |
| `zentao_list_bugs` | id, title, status, severity, pri, assignedTo.realname, product |
| `zentao_add_bug_comment` | 操作结果 |
| `zentao_find_user` | id, account, realname |

## 删除的 tool

- `zentao_get_current_user` — 合并到 ping
- `zentao_list_executions` — 不使用执行模块
- `zentao_start_task` / `zentao_finish_task` — 后续按需加
- `zentao_get_story` — 后续按需加
