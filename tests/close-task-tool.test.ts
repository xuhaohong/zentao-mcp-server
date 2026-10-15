import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

import type { ZenTaoClient } from "../src/clients/zentao-client.js";
import { registerTaskTools } from "../src/tools/task-tools.js";
import type { ZenTaoTask } from "../src/types/zentao.js";
import { ZenTaoApiError } from "../src/utils/errors.js";

type CloseTask = (taskId: number, comment?: string) => Promise<ZenTaoTask>;

async function createSession(context: TestContext, closeTask: CloseTask): Promise<Client> {
  const server = new McpServer({ name: "close-task-test-server", version: "0.0.0" });
  const client = new Client({ name: "close-task-test-client", version: "0.0.0" });
  registerTaskTools(server, { closeTask } as unknown as ZenTaoClient);

  context.after(async () => {
    await client.close();
    await server.close();
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

test("zentao_close_task exposes its input schema and write annotations over MCP", async (context) => {
  const client = await createSession(context, async () => {
    throw new Error("工具发现不应调用业务接口");
  });
  const { tools } = await client.listTools();
  const tool = tools.find((item) => item.name === "zentao_close_task");

  assert.ok(tool, "tools/list 应包含 zentao_close_task");
  assert.match(tool.description ?? "", /关闭/);
  assert.equal(tool.inputSchema.type, "object");
  assert.deepEqual(tool.inputSchema.required, ["taskId"]);
  const properties = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
  assert.equal(properties.taskId.type, "integer");
  assert.equal(properties.taskId.exclusiveMinimum, 0);
  assert.equal(properties.comment.type, "string");
  assert.equal(properties.comment.minLength, 1);
  assert.deepEqual(tool.annotations, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true
  });
});

test("zentao_close_task preserves the comment and returns the closed task over MCP", async (context) => {
  const calls: Array<{ taskId: number; comment?: string }> = [];
  const client = await createSession(context, async (taskId, comment) => {
    calls.push({ taskId, comment });
    return {
      id: taskId,
      name: "任务关闭回归",
      status: "closed",
      pri: 2,
      assignedTo: "tester",
      deadline: "2026-10-15",
      estimate: 3,
      left: 0,
      consumed: 3,
      internalOnly: "不应出现在任务摘要中"
    };
  });
  const comment = "  验收通过，关闭任务。  ";
  const result = CallToolResultSchema.parse(
    await client.callTool({ name: "zentao_close_task", arguments: { taskId: 123, comment } })
  );

  assert.deepEqual(calls, [{ taskId: 123, comment }]);
  assert.notEqual(result.isError, true);
  assert.ok(Array.isArray(result.content));
  const text = result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
  assert.match(text, /关闭/);
  assert.match(text, /任务关闭回归/);
  assert.deepEqual(result.structuredContent, {
    item: {
      id: 123,
      name: "任务关闭回归",
      status: "closed",
      pri: 2,
      assignedTo: "tester",
      deadline: "2026-10-15",
      estimate: 3,
      left: 0,
      consumed: 3
    }
  });
});

test("zentao_close_task accepts omitted comments and uses the task ID when no name is returned", async (context) => {
  const calls: Array<{ taskId: number; comment?: string }> = [];
  const client = await createSession(context, async (taskId, comment) => {
    calls.push({ taskId, comment });
    return { id: taskId, status: "closed" };
  });
  const result = CallToolResultSchema.parse(
    await client.callTool({ name: "zentao_close_task", arguments: { taskId: 456 } })
  );

  assert.deepEqual(calls, [{ taskId: 456, comment: undefined }]);
  assert.notEqual(result.isError, true);
  const text = result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
  assert.match(text, /关闭/);
  assert.match(text, /456/);
  const item = result.structuredContent?.item as Record<string, unknown>;
  assert.equal(item.id, 456);
  assert.equal(item.status, "closed");
});

test("zentao_close_task rejects invalid MCP arguments before calling the business client", async (context) => {
  let calls = 0;
  const client = await createSession(context, async (taskId) => {
    calls++;
    return { id: taskId, status: "closed" };
  });
  const invalidArguments = [
    {},
    { taskId: 0 },
    { taskId: -1 },
    { taskId: 1.5 },
    { taskId: "123" },
    { taskId: null },
    { taskId: 123, comment: "" },
    { taskId: 123, comment: 42 },
    { taskId: 123, comment: null }
  ];

  for (const args of invalidArguments) {
    const result = CallToolResultSchema.parse(await client.callTool({ name: "zentao_close_task", arguments: args }));
    assert.equal(result.isError, true, `应拒绝非法参数：${JSON.stringify(args)}`);
    const text = result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
    assert.match(text, /Input validation error/);
    assert.equal(result.structuredContent, undefined);
  }
  assert.equal(calls, 0, "非法参数不应触发任务关闭");
});

test("zentao_close_task reports business failures as MCP tool errors without claiming success", async (context) => {
  const calls: number[] = [];
  const client = await createSession(context, async (taskId) => {
    calls.push(taskId);
    throw new ZenTaoApiError("任务尚未完成，不能关闭");
  });
  const result = CallToolResultSchema.parse(
    await client.callTool({ name: "zentao_close_task", arguments: { taskId: 123 } })
  );

  assert.deepEqual(calls, [123]);
  assert.equal(result.isError, true);
  const text = result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
  assert.match(text, /任务尚未完成，不能关闭/);
  assert.doesNotMatch(text, /关闭成功|已关闭/);
  assert.equal(result.structuredContent, undefined);
});
