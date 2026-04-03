import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ZenTaoClient } from "../clients/zentao-client.js";
import { pickStory, textContent } from "../utils/output.js";

export function registerStoryTools(server: McpServer, client: ZenTaoClient): void {
  server.registerTool(
    "zentao_list_stories",
    {
      title: "List ZenTao Stories",
      description: "获取指定产品下的需求列表。",
      inputSchema: {
        productId: z.number().int().positive().describe("产品 ID")
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ productId }) => {
      const all = await client.listStories(productId);
      const items = all.map((s) => pickStory(s as unknown as Record<string, unknown>));
      return {
        content: textContent(`已获取 ${items.length} 条需求。`),
        structuredContent: { items, total: items.length }
      };
    }
  );
}
