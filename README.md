# zentao-mcp-server

一个独立的本地 `stdio` MCP Server，用于把禅道 REST API 暴露给支持 MCP 的客户端。

## 一键安装（推荐）

```bash
npx -y zentao-mcp-installer
```

也可以直接使用安装器入口：

```bash
npx --yes --package=zentao-mcp-installer --call "zentao-mcp-install"
```

安装器会自动：
- 检测已安装的 MCP 客户端（Claude Code、Cursor、Windsurf 等）
- 引导你配置禅道连接信息
- 将 MCP 服务器注册到选定的客户端

**支持的客户端**：
- ✅ Claude Code
- ✅ Claude Desktop
- ✅ Cursor
- ✅ Windsurf
- ✅ Codex CLI
- ✅ Continue

安装完成后，重启对应的客户端即可使用。

## 手动安装

如果你更喜欢手动配置，可以按照以下步骤操作。

### 1. 创建配置文件

```bash
mkdir -p ~/.agents/mcp/zentao-mcp-server
cat > ~/.agents/mcp/zentao-mcp-server/config.json << EOF
{
  "baseUrl": "http://zentao.example.com",
  "token": "",
  "account": "your-account",
  "password": "your-password",
  "timeoutMs": 15000
}
EOF
```

### 2. 添加到客户端配置

编辑 `~/.claude.json`（或其他客户端配置文件）：

```json
{
  "mcpServers": {
    "zentao": {
      "command": "npx",
      "args": ["--yes", "--package=zentao-mcp-installer", "--call", "zentao-mcp-server"],
      "env": {
        "ZENTAO_CONFIG": "~/.agents/mcp/zentao-mcp-server/config.json"
      }
    }
  }
}
```

### 3. 重启客户端

重启对应的 MCP 客户端即可使用。

## 功能范围

当前版本提供以下工具：

- `zentao_ping`
- `zentao_find_user`
- `zentao_list_products`
- `zentao_list_projects`
- `zentao_list_stories`
- `zentao_list_project_tasks`
- `zentao_get_task`
- `zentao_create_task`
- `zentao_create_child_task`
- `zentao_delete_task`
- `zentao_add_task_comment`
- `zentao_list_bugs`
- `zentao_add_bug_comment`

其中子任务创建 `zentao_create_child_task` 的参数约定为：

- 必填：`name`、`parent`
- 可选：`storyId`、`type`、`assignedTo`、`estStarted`、`deadline`、`estimate`、`desc`
- 不再接收 `execution`
- 实际写入的 `execution` 会根据父任务自动解析
- `storyId` 只有在显式传入时才会关联到子任务，不会从父任务自动继承

## 环境要求

- Node.js `18+`
- 能访问你的禅道实例

## 安装

```bash
npm install
```

## 配置

复制一份本地配置文件：

```bash
cp config/zentao.config.example.json config/zentao.config.local.json
```

然后填写以下字段：

```json
{
  "baseUrl": "https://zentao.example.com",
  "token": "",
  "account": "",
  "password": "",
  "timeoutMs": 15000
}
```

规则：

- `token` 有值时优先直接使用
- `token` 为空时，必须同时填写 `account` 和 `password`
- 登录获得的 token 只在进程内缓存，不会回写到配置文件
- `baseUrl` 推荐填写禅道站点根地址，例如 `http://host/zentao`
- 如果你误填成 `http://host/zentao/my.html` 这类页面地址，server 会自动归一化为站点根地址

## 构建

```bash
npm run build
```

## 本地启动

```bash
node dist/index.js --config ./config/zentao.config.local.json
```

如果不传 `--config`，默认读取当前工作目录下的 `config/zentao.config.local.json`。

## 在 MCP 客户端中接入

以 Claude Desktop / Codex 一类本地 MCP 配置为例：

```json
{
  "mcpServers": {
    "zentao": {
      "command": "node",
      "args": [
        "/Users/bibilabu/dev/projects/zentao-mcp-server/dist/index.js",
        "--config",
        "/Users/bibilabu/dev/projects/zentao-mcp-server/config/zentao.config.local.json"
      ]
    }
  }
}
```

## 设计要点

- 使用 JSON 配置，不依赖环境变量
- 优先使用禅道官方 REST API 文档中的 `v2` 接口
- 当实例上的 `v2` 接口不可用或返回结构异常时，客户端会自动回退到对应的 `v1` 接口
- 列表工具统一支持本地分页和关键词过滤
- 每个工具都同时返回简短文本摘要与结构化 JSON

## 后续扩展

- 增加 `zentao_create_story`
- 增加 `zentao_create_bug`
- 增加 `zentao_close_task`
- 基于现有底层工具封装高阶 workflow tools
