import test from "node:test";
import assert from "node:assert/strict";

import { ZenTaoClient } from "../src/clients/zentao-client.js";
import { registerTaskTools } from "../src/tools/task-tools.js";

type FetchCall = {
  url: URL;
  init?: RequestInit;
};

function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers
  });
}

test("zentao_create_child_task schema removes execution and exposes storyId", async () => {
  const tools = new Map<string, { options: unknown }>();
  const fakeServer = {
    registerTool(name: string, options: unknown) {
      tools.set(name, { options });
    }
  };

  registerTaskTools(fakeServer as never, {} as never);

  const childTaskTool = tools.get("zentao_create_child_task");
  assert.ok(childTaskTool, "应注册 zentao_create_child_task");

  const inputSchema = (childTaskTool.options as { inputSchema: Record<string, unknown> }).inputSchema;
  assert.ok(!("execution" in inputSchema), "子任务入参不应再暴露 execution");
  assert.ok("storyId" in inputSchema, "子任务入参应暴露 storyId");
});

test("createChildTask resolves execution from parent task and does not inherit parent story", async () => {
  const calls: FetchCall[] = [];
  const createdBodies: unknown[] = [];
  const editBodies: string[] = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push({ url, init });

    if (url.pathname.endsWith("/api.php/v1/tokens")) {
      return createJsonResponse({ token: "test-token" });
    }

    if (url.pathname.endsWith("/api.php/v2/tasks/100") || url.pathname.endsWith("/api.php/v1/tasks/100")) {
      return createJsonResponse({
        id: 100,
        name: "parent-task",
        execution: 23,
        story: 321,
        status: "wait"
      });
    }

    if (url.pathname.endsWith("/api.php/v1/executions/23/tasks") && init?.method === "POST") {
      createdBodies.push(JSON.parse(String(init.body)));
      return createJsonResponse({ id: 501 }, { status: 201 });
    }

    if (url.pathname.endsWith("/api.php/v2/tasks/501") || url.pathname.endsWith("/api.php/v1/tasks/501")) {
      return createJsonResponse({
        id: 501,
        name: "child-task",
        parent: 100,
        project: 22,
        execution: 23,
        story: 999,
        status: "wait"
      });
    }

    if (url.pathname.endsWith("/user-login.json") && (!init?.method || init.method === "GET")) {
      return createJsonResponse(
        { data: "{\"rand\":\"abc\"}" },
        { headers: { "set-cookie": "sid=first;" } }
      );
    }

    if (url.pathname.endsWith("/user-login.json") && init?.method === "POST") {
      return createJsonResponse(
        { user: { id: 1 } },
        { headers: { "set-cookie": "sid=second;" } }
      );
    }

    if (url.pathname.endsWith("/task-edit-501.json") && init?.method === "POST") {
      editBodies.push(String(init.body));
      return createJsonResponse({ status: "success" });
    }

    throw new Error(`unexpected fetch: ${init?.method ?? "GET"} ${url.toString()}`);
  }) as typeof fetch;

  try {
    const client = new ZenTaoClient({
      baseUrl: "http://zentao.example.com",
      account: "tester",
      password: "secret",
      timeoutMs: 15000
    });

    const task = await client.createChildTask({
      name: "child-task",
      parent: 100,
      story: 999,
      assignedTo: "tester",
      estimate: 1
    } as never);

    assert.equal(task.id, 501);

    const createCall = calls.find((call) => call.url.pathname.endsWith("/api.php/v1/executions/23/tasks"));
    assert.ok(createCall, "应使用父任务的 execution=23 创建子任务");

    const wrongExecutionCall = calls.find((call) => call.url.pathname.endsWith("/api.php/v1/executions/999/tasks"));
    assert.equal(wrongExecutionCall, undefined, "不应使用调用方传入或猜测出来的错误 execution");

    assert.equal(createdBodies.length, 1);
    assert.deepEqual(createdBodies[0], {
      name: "child-task",
      type: "devel",
      assignedTo: "tester",
      estimate: 1,
      story: 999
    });

    assert.equal(editBodies.length, 1);
    assert.match(editBodies[0], /(?:^|&)story=999(?:&|$)/, "补 parent 时应保留显式传入的 story");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
