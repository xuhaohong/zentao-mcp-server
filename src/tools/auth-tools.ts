import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ZenTaoClient } from "../clients/zentao-client.js";
import { textContent } from "../utils/output.js";

export function registerAuthTools(server: McpServer, client: ZenTaoClient): void {
  server.registerTool(
    "zentao_ping",
    {
      title: "ZenTao Ping",
      description: "检查禅道连接和当前认证是否可用。",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      const result = await client.ping();
      const userLabel = result.user.realname ?? result.user.account ?? String(result.user.id);
      return {
        content: textContent(`禅道连接正常，当前用户：${userLabel}`),
        structuredContent: result
      };
    }
  );
}
