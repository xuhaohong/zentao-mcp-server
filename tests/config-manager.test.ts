import path from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import test from "node:test";
import assert from "node:assert/strict";

const originalHome = process.env.HOME;
const fakeHome = mkdtempSync(path.join(os.tmpdir(), "zentao-config-home-"));

let configManager: typeof import("../src/installer/config-manager.js");

test.before(async () => {
  process.env.HOME = fakeHome;
  configManager = await import("../src/installer/config-manager.js");
});

test.after(() => {
  process.env.HOME = originalHome;
  rmSync(fakeHome, { recursive: true, force: true });
});

test("readConfig rejects invalid JSON instead of silently returning null", () => {
  const configPath = configManager.getConfigPath();
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, "{ invalid json", "utf8");

  assert.throws(() => configManager.readConfig(), /配置文件不是合法 JSON/u);
});

test("readConfig rejects structurally invalid config files", () => {
  const configPath = configManager.getConfigPath();
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    JSON.stringify({
      baseUrl: "http://zentao.example.com",
      timeoutMs: 15000
    }),
    "utf8"
  );

  assert.throws(() => configManager.readConfig(), /必须提供 token/u);
});

test("saveConfig and readConfig share the same normalized config contract", () => {
  configManager.saveConfig({
    baseUrl: "http://zentao.example.com/index.php?m=user&f=login",
    account: "tester",
    password: "secret",
    timeoutMs: 15000
  });

  const config = configManager.readConfig();
  assert.equal(config.baseUrl, "http://zentao.example.com");
  assert.equal(config.account, "tester");
});
