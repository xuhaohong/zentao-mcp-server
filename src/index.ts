import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ZenTaoClient } from "./clients/zentao-client.js";
import { loadConfig } from "./config/load-config.js";
import { runCliEntrypoint } from "./entrypoint.js";
import { runInstallerCli } from "./installer/cli.js";
import { registerAuthTools } from "./tools/auth-tools.js";
import { registerBugTools } from "./tools/bug-tools.js";
import { registerProductTools } from "./tools/product-tools.js";
import { registerProjectTools } from "./tools/project-tools.js";
import { registerStoryTools } from "./tools/story-tools.js";
import { registerTaskTools } from "./tools/task-tools.js";
import { registerUserTools } from "./tools/user-tools.js";
import { formatUnknownError } from "./utils/errors.js";

function resolveConfigPath(argv: string[]): string {
  // 优先级 1: 环境变量 ZENTAO_CONFIG（用于安装器）
  if (process.env.ZENTAO_CONFIG) {
    return process.env.ZENTAO_CONFIG;
  }

  // 优先级 2: 命令行参数 --config
  const configFlagIndex = argv.findIndex((item) => item === "--config");
  if (configFlagIndex >= 0) {
    const filePath = argv[configFlagIndex + 1];
    if (!filePath) {
      throw new Error("`--config` 后必须跟配置文件路径");
    }
    return filePath;
  }

  // 优先级 3: 默认路径
  return path.resolve(process.cwd(), "config/zentao.config.local.json");
}

async function main(): Promise<void> {
  await runCliEntrypoint(
    process.argv.slice(2),
    async () => {
      const configPath = resolveConfigPath(process.argv.slice(2));
      const config = await loadConfig(configPath);
      const client = new ZenTaoClient(config);

      const server = new McpServer({
        name: "zentao-mcp-server",
        version: "0.1.0"
      });

      registerAuthTools(server, client);
      registerUserTools(server, client);
      registerProductTools(server, client);
      registerProjectTools(server, client);
      registerStoryTools(server, client);
      registerTaskTools(server, client);
      registerBugTools(server, client);

      const transport = new StdioServerTransport();
      await server.connect(transport);
    },
    runInstallerCli
  );
}

main().catch((error) => {
  console.error(`[zentao-mcp-server] ${formatUnknownError(error)}`);
  process.exit(1);
});
