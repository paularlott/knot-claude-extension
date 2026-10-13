import assert from "node:assert/strict";
import { test } from "node:test";

import { describe } from "../src/errors.js";

function fetchError(code, message) {
  const cause = Object.assign(new Error(message), { code });
  return new Error("fetch failed", { cause });
}

test("describe includes the underlying cause", () => {
  assert.equal(describe(fetchError("ECONNREFUSED", "connect ECONNREFUSED 127.0.0.1:443")), "fetch failed: connect ECONNREFUSED 127.0.0.1:443");
  assert.equal(describe(new Error("plain")), "plain");
});

test("describe explains macOS Local Network permission for unreachable hosts", () => {
  const err = fetchError("EHOSTUNREACH", "connect EHOSTUNREACH 192.168.8.53:443");
  assert.match(describe(err, "darwin"), /allow Claude in System Settings > Privacy & Security > Local Network/);
  assert.doesNotMatch(describe(err, "win32"), /Local Network/);
});
