import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ZenTaoClient } from "../clients/zentao-client.js";
import { formatLocalDate } from "../utils/local-date.js";
import { buildItemSummary, pickTaskDetail, pickTaskSummary, textContent } from "../utils/output.js";

function resolveDefaultDate(value: string | undefined): string {
  return value ?? formatLocalDate();
}

export function registerTaskTools(server: McpServer, client: ZenTaoClient): void {
  server.registerTool(
    "zentao_list_project_tasks",
    {
      title: "List Project Tasks",
      description: "获取指定项目下的任务列表。支持按状态过滤：all|unclosed|assignedtome|wait|doing|done|closed。",
      inputSchema: {
        projectId: z.number().int().positive().describe("项目 ID"),
        status: z.string().optional().describe("任务状态过滤，默认 all")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ projectId, status }) => {
      const all = await client.listTasks(projectId, status);
      const items = all.map((t) => pickTaskSummary(t as unknown as Record<string, unknown>));
      return {
        content: textContent(`已获取 ${items.length} 条任务。`),
        structuredContent: { items, total: items.length }
      };
    }
  );

  server.registerTool(
    "zentao_get_task",
    {
      title: "Get ZenTao Task",
      description: "获取单个禅道任务详情，包含子任务信息。",
      inputSchema: {
        taskId: z.number().int().positive().describe("任务 ID")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ taskId }) => {
      const raw = await client.getTask(taskId);
      const item = pickTaskDetail(raw as unknown as Record<string, unknown>);
      return {
        content: textContent(buildItemSummary("任务", raw)),
        structuredContent: { item }
      };
    }
  );

  server.registerTool(
    "zentao_create_task",
    {
      title: "Create ZenTao Task",
      description: "在指定项目下创建禅道任务。type 默认 devel，estStarted 默认当天。",
      inputSchema: {
        name: z.string().min(1).describe("任务名称"),
        projectId: z.number().int().positive().describe("所属项目 ID"),
        type: z.string().default("devel").describe("任务类型，默认 devel"),
        assignedTo: z.string().optional().describe("指派给"),
        pri: z.number().int().positive().max(4).optional().describe("优先级"),
        estimate: z.number().nonnegative().optional().describe("预计工时"),
        estStarted: z.string().optional().describe("预计开始日期，格式 YYYY-MM-DD，默认当天"),
        deadline: z.string().optional().describe("截止日期，格式 YYYY-MM-DD"),
        desc: z.string().optional().describe("任务描述")
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ projectId, estStarted, deadline, ...rest }) => {
      const raw = await client.createTask({
        project: projectId,
        estStarted: resolveDefaultDate(estStarted),
        deadline: resolveDefaultDate(deadline),
        ...rest
      });
      const item = pickTaskSummary(raw as unknown as Record<string, unknown>);
      return {
        content: textContent(`任务创建成功：${raw.name ?? raw.id}`),
        structuredContent: { item }
      };
    }
  );

  server.registerTool(
    "zentao_create_child_task",
    {
      title: "Create Child Task",
      description: "根据父任务自动定位执行后创建禅道子任务，可选关联需求。",
      inputSchema: {
        name: z.string().min(1).describe("子任务名称"),
        parent: z.number().int().positive().describe("父任务 ID"),
        storyId: z.number().int().positive().optional().describe("可选，关联的需求 ID"),
        type: z.string().default("devel").describe("任务类型，默认 devel"),
        assignedTo: z.string().optional().describe("指派给"),
        estStarted: z.string().optional().describe("预计开始日期，格式 YYYY-MM-DD，默认当天"),
        deadline: z.string().optional().describe("截止日期，格式 YYYY-MM-DD，默认当天"),
        estimate: z.number().nonnegative().optional().describe("预计工时"),
        desc: z.string().optional().describe("任务描述")
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ estStarted, deadline, storyId, ...rest }) => {
      const raw = await client.createChildTask({
        ...rest,
        story: storyId,
        estStarted: resolveDefaultDate(estStarted),
        deadline: resolveDefaultDate(deadline)
      });
      const item = pickTaskSummary(raw as unknown as Record<string, unknown>);
      return {
        content: textContent(`子任务创建成功：${raw.name ?? raw.id}`),
        structuredContent: { item }
      };
    }
  );

  server.registerTool(
    "zentao_delete_task",
    {
      title: "Delete ZenTao Task",
      description: "删除禅道任务。",
      inputSchema: {
        taskId: z.number().int().positive().describe("任务 ID")
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
    },
    async ({ taskId }) => {
      await client.deleteTask(taskId);
      return { content: textContent(`任务 ${taskId} 已删除。`) };
    }
  );

  server.registerTool(
    "zentao_add_task_comment",
    {
      title: "Add Task Comment",
      description: "给禅道任务添加备注。",
      inputSchema: {
        taskId: z.number().int().positive().describe("任务 ID"),
        comment: z.string().min(1).describe("备注内容")
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ taskId, comment }) => {
      await client.addTaskComment(taskId, comment);
      return {
        content: textContent(`已为任务 ${taskId} 添加备注。`)
      };
    }
  );
}
