import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ZenTaoClient } from "../clients/zentao-client.js";
import { pickProduct, textContent } from "../utils/output.js";

export function registerProductTools(server: McpServer, client: ZenTaoClient): void {
  server.registerTool(
    "zentao_list_products",
    {
      title: "List ZenTao Products",
      description: "获取禅道产品列表。",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      const all = await client.listProducts();
      const items = all.map((p) => pickProduct(p as unknown as Record<string, unknown>));
      return {
        content: textContent(`已获取 ${items.length} 个产品。`),
        structuredContent: { items, total: items.length }
      };
    }
  );
}
