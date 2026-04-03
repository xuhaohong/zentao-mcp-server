/**
 * 配置注入器
 * 将 MCP 配置注入到各客户端配置文件
 */

import * as fs from 'fs';
import * as toml from '@iarna/toml';
import { DetectedClient } from './detector.js';
import { getConfigPath } from './config-manager.js';

export interface MCPConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/**
 * 注入配置到客户端
 */
export function injectToClient(
  client: DetectedClient,
  mcpConfig: MCPConfig
): void {
  if (client.configFormat === 'json') {
    injectToJSON(client.resolvedPath, client.mcpField, mcpConfig);
  } else if (client.configFormat === 'toml') {
    injectToTOML(client.resolvedPath, mcpConfig);
  }
}

/**
 * 注入到 JSON 配置文件
 */
function injectToJSON(
  configPath: string,
  mcpField: string,
  mcpConfig: MCPConfig
): void {
  // 读取现有配置
  let config: any = {};
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(content);
  }

  // 确保 mcpServers 字段存在
  if (!config[mcpField]) {
    config[mcpField] = {};
  }

  // 注入 zentao 配置
  config[mcpField].zentao = mcpConfig;

  // 保存配置
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2),
    'utf-8'
  );
}

/**
 * 注入到 TOML 配置文件
 */
function injectToTOML(
  configPath: string,
  mcpConfig: MCPConfig
): void {
  // 读取现有配置
  let config: any = {};
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    config = toml.parse(content);
  }

  // 确保 mcp.servers 字段存在
  if (!config.mcp) config.mcp = {};
  if (!config.mcp.servers) config.mcp.servers = {};

  // 注入 zentao 配置
  config.mcp.servers.zentao = mcpConfig;

  // 保存配置
  fs.writeFileSync(
    configPath,
    toml.stringify(config),
    'utf-8'
  );
}

/**
 * 创建 MCP 配置
 */
export function createMCPConfig(): MCPConfig {
  return {
    command: 'npx',
    args: ['-y', 'zentao-mcp-server'],
    env: {
      ZENTAO_CONFIG: getConfigPath()
    }
  };
}
