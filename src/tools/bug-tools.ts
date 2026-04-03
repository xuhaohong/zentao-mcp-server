import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ZenTaoClient } from "../clients/zentao-client.js";
import { pickBug, textContent } from "../utils/output.js";

export function registerBugTools(server: McpServer, client: ZenTaoClient): void {
  server.registerTool(
    "zentao_list_bugs",
    {
      title: "List ZenTao Bugs",
      description: "获取指定产品下的 Bug 列表，可按状态和指派人过滤。",
      inputSchema: {
        productId: z.number().int().positive().describe("产品 ID"),
        assignedTo: z.string().optional().describe("可选，按指派人账号过滤"),
        status: z.string().optional().describe("Bug 状态，默认 unclosed")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ productId, assignedTo, status }) => {
      const all = await client.listBugs(productId, { assignedTo, status: status ?? "unclosed" });
      const items = all.map((b) => pickBug(b as unknown as Record<string, unknown>));
      return {
        content: textContent(`已获取 ${items.length} 个 Bug。`),
        structuredContent: { items, total: items.length }
      };
    }
  );

  server.registerTool(
    "zentao_add_bug_comment",
    {
      title: "Add Bug Comment",
      description: "给禅道 Bug 添加备注。",
      inputSchema: {
        bugId: z.number().int().positive().describe("Bug ID"),
        comment: z.string().min(1).describe("备注内容")
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ bugId, comment }) => {
      await client.addBugComment(bugId, comment);
      return {
        content: textContent(`已为 Bug ${bugId} 添加备注。`)
      };
    }
  );
}
