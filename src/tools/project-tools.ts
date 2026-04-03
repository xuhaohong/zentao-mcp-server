import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ZenTaoClient } from "../clients/zentao-client.js";
import { pickProject, textContent } from "../utils/output.js";

export function registerProjectTools(server: McpServer, client: ZenTaoClient): void {
  server.registerTool(
    "zentao_list_projects",
    {
      title: "List ZenTao Projects",
      description: "获取禅道项目列表。",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      const all = await client.listProjects();
      const items = all.map((p) => pickProject(p as unknown as Record<string, unknown>));
      return {
        content: textContent(`已获取 ${items.length} 个项目。`),
        structuredContent: { items, total: items.length }
      };
    }
  );
}
