/**
 * 客户端检测器
 * 自动检测已安装的 MCP 客户端
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SUPPORTED_CLIENTS, Client } from './clients.js';

export interface DetectedClient extends Client {
  id: string;
  resolvedPath: string;
  exists: boolean;
}

/**
 * 检测已安装的客户端
 */
export function detectInstalledClients(): DetectedClient[] {
  const detected: DetectedClient[] = [];
  const platform = process.platform;

  for (const [id, client] of Object.entries(SUPPORTED_CLIENTS)) {
    const configPath = resolveConfigPath(client.configPath, platform);
    const exists = fs.existsSync(configPath);

    detected.push({
      id,
      ...client,
      resolvedPath: configPath,
      exists
    });
  }

  return detected.filter(c => c.exists);
}

/**
 * 解析配置文件路径
 */
function resolveConfigPath(
  pathTemplate: string | Record<string, string>,
  platform: NodeJS.Platform
): string {
  let template: string;

  if (typeof pathTemplate === 'string') {
    template = pathTemplate;
  } else {
    template = pathTemplate[platform] || pathTemplate['darwin'];
  }

  // 处理环境变量（Windows）
  if (platform === 'win32') {
    template = template.replace(/%([^%]+)%/g, (_, key) =>
      process.env[key] || ''
    );
  }

  // 处理 ~
  template = template.replace(/^~/, os.homedir());

  return path.resolve(template);
}
