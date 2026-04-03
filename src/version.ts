import { readFileSync } from "node:fs";

type PackageJson = {
  version: string;
};

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as PackageJson;

export function getPackageVersion(): string {
  return packageJson.version;
}
