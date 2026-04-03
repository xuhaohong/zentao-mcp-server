import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ZenTaoClient } from "../clients/zentao-client.js";
import { pickUser, textContent } from "../utils/output.js";

export function registerUserTools(server: McpServer, client: ZenTaoClient): void {
  server.registerTool(
    "zentao_find_user",
    {
      title: "Find ZenTao User",
      description: "按姓名或账号模糊搜索禅道用户。",
      inputSchema: {
        name: z.string().min(1).describe("搜索关键词，匹配用户姓名或账号")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ name }) => {
      const all = await client.listUsers();
      const kw = name.toLowerCase();
      const matched = all.filter((u) => {
        const r = (u.realname ?? "").toLowerCase();
        const a = (u.account ?? "").toLowerCase();
        return r.includes(kw) || a.includes(kw);
      });
      const items = matched.map((u) => pickUser(u as unknown as Record<string, unknown>));
      return {
        content: textContent(`找到 ${items.length} 个匹配用户。`),
        structuredContent: { items, total: items.length }
      };
    }
  );
}
