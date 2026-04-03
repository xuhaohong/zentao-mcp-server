import assert from "node:assert/strict";
import test from "node:test";

import { createMCPConfig } from "../src/installer/injector.js";

test("createMCPConfig installs the published package and runs the server bin", () => {
  const mcpConfig = createMCPConfig();

  assert.equal(mcpConfig.command, "npx");
  assert.deepEqual(mcpConfig.args, [
    "--yes",
    "--package=zentao-mcp-installer",
    "--call",
    "zentao-mcp-server"
  ]);
});
