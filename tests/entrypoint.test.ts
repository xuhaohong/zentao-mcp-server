import test from "node:test";
import assert from "node:assert/strict";

import { runCliEntrypoint } from "../src/entrypoint.js";

test("runCliEntrypoint routes install subcommand to installer", async () => {
  const calls: string[] = [];

  await runCliEntrypoint(
    ["install"],
    async () => {
      calls.push("server");
    },
    async () => {
      calls.push("installer");
    }
  );

  assert.deepEqual(calls, ["installer"]);
});

test("runCliEntrypoint starts server for non-install commands", async () => {
  const calls: string[] = [];

  await runCliEntrypoint(
    [],
    async () => {
      calls.push("server");
    },
    async () => {
      calls.push("installer");
    }
  );

  assert.deepEqual(calls, ["server"]);
});
