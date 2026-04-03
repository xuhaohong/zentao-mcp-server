/**
 * 客户端注册表
 * 定义所有支持的 MCP 客户端及其配置路径
 */

export interface Client {
  name: string;
  configPath: string | Record<string, string>;
  configFormat: 'json' | 'toml';
  mcpField: string;
  supported: boolean;
}

export const SUPPORTED_CLIENTS: Record<string, Client> = {
  'claude-code': {
    name: 'Claude Code',
    configPath: '~/.claude.json',
    configFormat: 'json',
    mcpField: 'mcpServers',
    supported: true
  },

  'claude-desktop': {
    name: 'Claude Desktop',
    configPath: {
      darwin: '~/Library/Application Support/Claude/claude_desktop_config.json',
      linux: '~/.config/Claude/claude_desktop_config.json',
      win32: '%APPDATA%/Claude/claude_desktop_config.json'
    },
    configFormat: 'json',
    mcpField: 'mcpServers',
    supported: true
  },

  'cursor': {
    name: 'Cursor',
    configPath: '~/.cursor/mcp.json',
    configFormat: 'json',
    mcpField: 'mcpServers',
    supported: true
  },

  'windsurf': {
    name: 'Windsurf',
    configPath: '~/.codeium/windsurf/mcp_config.json',
    configFormat: 'json',
    mcpField: 'mcpServers',
    supported: true
  },

  'codex': {
    name: 'Codex CLI',
    configPath: {
      darwin: '~/.codex/config.toml',
      linux: '~/.codex/config.toml',
      win32: '%CODEX_HOME%/config.toml'
    },
    configFormat: 'toml',
    mcpField: 'mcp.servers',
    supported: true
  },

  'continue': {
    name: 'Continue',
    configPath: '~/.continue/config.json',
    configFormat: 'json',
    mcpField: 'mcpServers',
    supported: true
  }
};
