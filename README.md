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
- `zentao_close_task`
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

### 关闭任务

`zentao_close_task` 接收必填的正整数 `taskId` 和可选的非空字符串 `comment`：

```json
{
  "taskId": 123,
  "comment": "验收通过，关闭任务。"
}
```

不需要备注时省略 `comment`。成功后返回任务摘要，`structuredContent.item.status` 为 `closed`。
是否允许关闭由禅道的权限和任务状态规则决定；此工具不会自动完成任务或强制关闭其子任务。

关闭操作优先调用 [REST v2 的 PUT 接口](https://www.zentao.net/book/api/put-tasks-taskid-close-2213.html)，
仅在 HTTP 404/405 时回退到 [REST v1 的 POST 接口](https://www.zentao.net/book/api/1200.html)。
权限错误、业务拒绝、网络异常和无法识别的响应不会触发另一次关闭写入。
工具会在写入后查询任务，确认 ID 和 `closed` 状态后才返回成功；如果提示无法确认，请先查询任务状态再决定后续操作。

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

## 测试

```bash
node --import tsx --test tests/*.test.ts
```

关闭任务测试使用模拟禅道响应和 MCP 内存传输，不会修改真实禅道任务。

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
- 查询接口在 `v2` 不可用或返回结构异常时会回退到对应的 `v1` 接口；关闭任务的回退条件见上文
- 列表工具统一支持本地分页和关键词过滤
- 每个工具都同时返回简短文本摘要与结构化 JSON

## 后续扩展

- 增加 `zentao_create_story`
- 增加 `zentao_create_bug`
- 基于现有底层工具封装高阶 workflow tools
