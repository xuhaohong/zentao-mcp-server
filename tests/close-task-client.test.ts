import test from "node:test";
import assert from "node:assert/strict";

import { ZenTaoClient } from "../src/clients/zentao-client.js";

type FetchCall = { method: string; path: string; body: unknown };
const closedTask = { id: 42, name: "已验收任务", status: "closed" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function withFetch(
  respond: (call: FetchCall) => Response,
  run: (client: ZenTaoClient, calls: FetchCall[]) => Promise<void>
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, "https://zentao.example.com");
    assert.equal(new Headers(init?.headers).get("Token"), "test-token");
    const call = {
      method: init?.method ?? "GET",
      path: url.pathname,
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  try {
    await run(new ZenTaoClient({ baseUrl: "https://zentao.example.com", token: "test-token", timeoutMs: 1000 }), calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("closeTask sends a v2 PUT with the comment and verifies the resulting task", async () => {
  await withFetch((call) => {
    if (call.method === "PUT" && call.path === "/api.php/v2/tasks/42/close") return json({ status: "success" });
    if (call.method === "GET" && call.path === "/api.php/v2/tasks/42") return json(closedTask);
    throw new Error(`Unexpected request: ${call.method} ${call.path}`);
  }, async (client, calls) => {
    assert.deepEqual(await client.closeTask(42, "验收通过\n保留备注格式"), closedTask);
    assert.deepEqual(calls, [
      { method: "PUT", path: "/api.php/v2/tasks/42/close", body: { comment: "验收通过\n保留备注格式" } },
      { method: "GET", path: "/api.php/v2/tasks/42", body: undefined }
    ]);
  });
});

for (const status of [404, 405]) {
  test(`closeTask falls back to v1 POST only when v2 is unsupported (${status})`, async () => {
    await withFetch((call) => {
      if (call.method === "PUT" && call.path === "/api.php/v2/tasks/42/close") return json({ message: "Unsupported route" }, status);
      if (call.method === "POST" && call.path === "/api.php/v1/tasks/42/close") return json(closedTask);
      if (call.method === "GET" && call.path === "/api.php/v2/tasks/42") return json({ message: "Unsupported route" }, 404);
      if (call.method === "GET" && call.path === "/api.php/v1/tasks/42") return json(closedTask);
      throw new Error(`Unexpected request: ${call.method} ${call.path}`);
    }, async (client, calls) => {
      assert.deepEqual(await client.closeTask(42), closedTask);
      assert.deepEqual(calls, [
        { method: "PUT", path: "/api.php/v2/tasks/42/close", body: { comment: "" } },
        { method: "POST", path: "/api.php/v1/tasks/42/close", body: { comment: "" } },
        { method: "GET", path: "/api.php/v2/tasks/42", body: undefined },
        { method: "GET", path: "/api.php/v1/tasks/42", body: undefined }
      ]);
    });
  });
}

for (const status of [401, 403, 500]) {
  test(`closeTask does not repeat a write after HTTP ${status}`, async () => {
    await withFetch(() => json({ message: "close denied" }, status), async (client, calls) => {
      await assert.rejects(() => client.closeTask(42), /close denied/);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, "PUT");
    });
  });
}

for (const failure of [{ status: "fail", message: "permission denied" }, { result: "fail", callback: "confirmChildren" }]) {
  test(`closeTask rejects a business failure without retrying: ${JSON.stringify(failure)}`, async () => {
    await withFetch(() => json(failure), async (client, calls) => {
      await assert.rejects(() => client.closeTask(42));
      assert.equal(calls.length, 1);
    });
  });
}

test("closeTask does not repeat an ambiguous write after a network failure", async () => {
  await withFetch(() => { throw new Error("connection lost"); }, async (client, calls) => {
    await assert.rejects(() => client.closeTask(42), /connection lost/);
    assert.equal(calls.length, 1);
  });
});

test("closeTask does not treat an unexpected response as success or repeat the write", async () => {
  await withFetch(() => new Response("<html>Login</html>"), async (client, calls) => {
    await assert.rejects(() => client.closeTask(42), /无法确认/);
    assert.equal(calls.length, 1);
  });
});

for (const task of [{ ...closedTask, status: "done" }, { ...closedTask, id: 99 }]) {
  test(`closeTask rejects an unconfirmed final state: ${JSON.stringify(task)}`, async () => {
    await withFetch((call) => {
      if (call.method === "PUT") return json({ status: "success" });
      if (call.method === "GET" && call.path === "/api.php/v2/tasks/42") return json(task);
      throw new Error(`Unexpected request: ${call.method} ${call.path}`);
    }, async (client, calls) => {
      await assert.rejects(() => client.closeTask(42), /无法确认/);
      assert.equal(calls.filter((call) => call.method !== "GET").length, 1);
    });
  });
}

test("closeTask reports an accepted write with failed verification without repeating it", async () => {
  await withFetch((call) => call.method === "PUT" ? json({ status: "success" }) : json({ message: "read unavailable" }, 503), async (client, calls) => {
    await assert.rejects(() => client.closeTask(42), /关闭请求已发送.*无法确认.*read unavailable/);
    assert.equal(calls.filter((call) => call.method !== "GET").length, 1);
  });
});
