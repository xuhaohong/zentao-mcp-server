import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

type PackageJson = {
  version: string;
  bin: Record<string, string>;
  repository: {
    url: string;
  };
};

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, "package.json"), "utf8")
) as PackageJson;

test("package bin entries use npm publish compatible paths", () => {
  for (const [command, target] of Object.entries(packageJson.bin)) {
    assert.equal(
      target.startsWith("./"),
      false,
      `bin ${command} should omit the leading ./ so npm keeps the executable entry`
    );
  }
});

test("package repository url uses npm canonical git transport", () => {
  assert.equal(
    packageJson.repository.url,
    "git+https://github.com/xuhaohong/zentao-mcp-server.git"
  );
});

test("server metadata uses the shared package version helper", () => {
  const source = readFileSync(path.join(projectRoot, "src/index.ts"), "utf8");

  assert.match(source, /from "\.\/version\.js";/u);
  assert.match(source, /version:\s*getPackageVersion\(\)/u);
});

test("installer banner uses the shared package version helper", () => {
  const source = readFileSync(path.join(projectRoot, "src/installer/cli.ts"), "utf8");

  assert.match(source, /from '\.\.\/version\.js';/u);
  assert.match(source, /getPackageVersion\(\)/u);
});

test("README install snippets point to the published npm package", () => {
  const readme = readFileSync(path.join(projectRoot, "README.md"), "utf8");

  assert.match(readme, /npx -y zentao-mcp-installer/u);
  assert.match(
    readme,
    /"args": \["--yes", "--package=zentao-mcp-installer", "--call", "zentao-mcp-server"\]/u
  );
});
