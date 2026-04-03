import { readFile } from "node:fs/promises";
import path from "node:path";

import { ConfigError, formatUnknownError } from "../utils/errors.js";
import { zentaoConfigSchema, type ZenTaoConfig } from "../types/config.js";

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/[^/]+\.html(?:\?.*)?$/i, "")
    .replace(/\/index\.php(?:\?.*)?$/i, "")
    .replace(/\/api\.php(?:\/v\d+)?\/?$/i, "")
    .replace(/\/+$/u, "");
}

export function parseConfigValue(parsed: unknown, source: string): ZenTaoConfig {
  const result = zentaoConfigSchema.safeParse(parsed);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join("；");
    throw new ConfigError(`配置文件校验失败：${source}，${message}`);
  }

  return {
    ...result.data,
    baseUrl: normalizeBaseUrl(result.data.baseUrl)
  };
}

export function parseConfigText(fileContent: string, source: string): ZenTaoConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (error) {
    throw new ConfigError(`配置文件不是合法 JSON：${source}，${formatUnknownError(error)}`);
  }

  return parseConfigValue(parsed, source);
}

export async function loadConfig(configPath: string): Promise<ZenTaoConfig> {
  const resolvedPath = path.resolve(configPath);
  let fileContent: string;

  try {
    fileContent = await readFile(resolvedPath, "utf8");
  } catch (error) {
    throw new ConfigError(`无法读取配置文件：${resolvedPath}，${formatUnknownError(error)}`);
  }

  return parseConfigText(fileContent, resolvedPath);
}
