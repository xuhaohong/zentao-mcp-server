import test from "node:test";
import assert from "node:assert/strict";

import { ZenTaoClient } from "../src/clients/zentao-client.js";

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

function createClient(): ZenTaoClient {
  return new ZenTaoClient({
    baseUrl: "http://zentao.example.com",
    token: "test-token",
    timeoutMs: 15000
  });
}

test("listTasks returns an empty list for projects whose executions have no tasks", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);

    if (url.pathname.endsWith("/api.php/v2/projects/22/executions") || url.pathname.endsWith("/api.php/v1/projects/22/executions")) {
      return createJsonResponse({
        total: 1,
        executions: [{ id: 23, project: 22, status: "wait" }]
      });
    }

    if (url.pathname.endsWith("/api.php/v1/executions/23/tasks")) {
      return createJsonResponse({
        total: 0,
        tasks: []
      });
    }

    throw new Error(`unexpected fetch: ${init?.method ?? "GET"} ${url.toString()}`);
  }) as typeof fetch;

  try {
    const tasks = await createClient().listTasks(22);
    assert.deepEqual(tasks, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listTasks aggregates tasks from every execution under the project", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);

    if (url.pathname.endsWith("/api.php/v2/projects/22/executions") || url.pathname.endsWith("/api.php/v1/projects/22/executions")) {
      return createJsonResponse({
        total: 2,
        executions: [
          { id: 23, project: 22, status: "doing" },
          { id: 24, project: 22, status: "wait" }
        ]
      });
    }

    if (url.pathname.endsWith("/api.php/v1/executions/23/tasks")) {
      return createJsonResponse({
        total: 1,
        tasks: [{ id: 501, project: 22, execution: 23, name: "task-a" }]
      });
    }

    if (url.pathname.endsWith("/api.php/v1/executions/24/tasks")) {
      return createJsonResponse({
        total: 1,
        tasks: [{ id: 502, project: 22, execution: 24, name: "task-b" }]
      });
    }

    throw new Error(`unexpected fetch: ${init?.method ?? "GET"} ${url.toString()}`);
  }) as typeof fetch;

  try {
    const tasks = await createClient().listTasks(22);
    assert.deepEqual(
      tasks.map((task) => task.id),
      [501, 502]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createTask resolves execution from project executions instead of existing tasks", async () => {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push({ url, init });

    if (url.pathname.endsWith("/api.php/v2/projects/22/executions") || url.pathname.endsWith("/api.php/v1/projects/22/executions")) {
      return createJsonResponse({
        total: 2,
        executions: [
          { id: 23, project: 22, status: "closed" },
          { id: 24, project: 22, status: "doing" }
        ]
      });
    }

    if (url.pathname.endsWith("/api.php/v1/executions/24/tasks") && init?.method === "POST") {
      return createJsonResponse({ id: 601 }, { status: 201 });
    }

    if (url.pathname.endsWith("/api.php/v2/tasks/601") || url.pathname.endsWith("/api.php/v1/tasks/601")) {
      return createJsonResponse({
        id: 601,
        project: 22,
        execution: 24,
        name: "first-task"
      });
    }

    throw new Error(`unexpected fetch: ${init?.method ?? "GET"} ${url.toString()}`);
  }) as typeof fetch;

  try {
    const task = await createClient().createTask({
      name: "first-task",
      project: 22,
      assignedTo: "tester",
      estStarted: "2026-04-03",
      deadline: "2026-04-03"
    });

    assert.equal(task.id, 601);

    const createCall = calls.find((call) => call.url.pathname.endsWith("/api.php/v1/executions/24/tasks"));
    assert.ok(createCall, "应选择 doing 状态的执行创建任务");

    const legacyLookup = calls.find((call) => call.url.pathname.endsWith("/api.php/v1/tasks"));
    assert.equal(legacyLookup, undefined, "不应再依赖 /tasks?project= 反推 execution");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
