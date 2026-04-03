import test from "node:test";
import assert from "node:assert/strict";

process.env.TZ = "Asia/Shanghai";

import { formatLocalDate } from "../src/utils/local-date.js";

test("formatLocalDate keeps the local calendar date at midnight instead of UTC date", () => {
  const date = new Date("2026-04-03T00:30:00+08:00");

  assert.equal(formatLocalDate(date), "2026-04-03");
});
