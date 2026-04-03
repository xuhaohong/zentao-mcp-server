/**
 * 配置管理器
 * 管理 ~/.agents/mcp/zentao-mcp-server/config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { parseConfigText, parseConfigValue } from '../config/load-config.js';
import type { ZenTaoConfig } from '../types/config.js';

export type ZentaoConfig = ZenTaoConfig;

const CONFIG_DIR = path.join(os.homedir(), '.agents/mcp/zentao-mcp-server');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * 检查配置文件是否存在
 */
export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

/**
 * 读取配置文件
 */
export function readConfig(): ZentaoConfig | null {
  if (!configExists()) return null;

  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  return parseConfigText(content, CONFIG_FILE);
}

/**
 * 保存配置文件
 */
export function saveConfig(config: ZentaoConfig): void {
  const normalizedConfig = parseConfigValue(config, CONFIG_FILE);

  // 确保目录存在
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  // 保存配置
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(normalizedConfig, null, 2),
    'utf-8'
  );

  // 设置文件权限（仅所有者可读写）
  if (process.platform !== 'win32') {
    fs.chmodSync(CONFIG_FILE, 0o600);
  }
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * 验证配置
 */
export function validateConfig(config: any): void {
  parseConfigValue(config, CONFIG_FILE);
}
