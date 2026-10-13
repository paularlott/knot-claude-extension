import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { configSearchPaths, configuredAliases, findConfigFile, mcpEndpoint, resolveConnection, setting } from "../src/config.js";

const config = {
  client: {
    connection: {
      default: { server: "https://knot.example.com", token: "tk_default" },
      work: { server: "https://work.example.com/mcp", token: "tk_work" },
    },
  },
};

test("setting ignores blank and unsubstituted values", () => {
  assert.equal(setting({ A: "value" }, "A"), "value");
  assert.equal(setting({ A: "  " }, "A"), undefined);
  assert.equal(setting({ A: "${user_config.alias}" }, "A"), undefined);
  assert.equal(setting({}, "A"), undefined);
});

test("mcpEndpoint accepts a server address or the endpoint URL", () => {
  for (const server of ["https://k.example.com", "https://k.example.com/", "https://k.example.com/mcp", "https://k.example.com/mcp/"]) {
    assert.equal(mcpEndpoint(server), "https://k.example.com/mcp");
  }
});

test("the default connection is used when nothing is set", () => {
  const c = resolveConnection({}, config);
  assert.equal(c.endpoint, "https://knot.example.com/mcp");
  assert.equal(c.token, "tk_default");
});

test("an alias picks its connection", () => {
  const c = resolveConnection({ KNOT_MCP_ALIAS: "work" }, config);
  assert.equal(c.endpoint, "https://work.example.com/mcp");
  assert.equal(c.token, "tk_work");
});

test("a blank or unsubstituted alias means default", () => {
  assert.equal(resolveConnection({ KNOT_MCP_ALIAS: "" }, config).token, "tk_default");
  assert.equal(resolveConnection({ KNOT_MCP_ALIAS: "${user_config.alias}" }, config).token, "tk_default");
});

test("a server URL and token override the config file", () => {
  const c = resolveConnection({ KNOT_SERVER: "https://other.example.com", KNOT_TOKEN: "tk_other" }, config);
  assert.equal(c.endpoint, "https://other.example.com/mcp");
  assert.equal(c.token, "tk_other");
});

test("a server URL without a token falls back to the alias", () => {
  assert.equal(resolveConnection({ KNOT_SERVER: "https://other.example.com" }, config).token, "tk_default");
});

test("a missing connection is a clear error", () => {
  assert.throws(() => resolveConnection({ KNOT_MCP_ALIAS: "missing" }, config), /no server configured for alias "missing"/);
  assert.throws(() => resolveConnection({}, {}), /no server configured for alias "default"/);
  assert.throws(() => resolveConnection({ KNOT_MCP_ALIAS: "bad alias!" }, config), /no server configured/);
});

test("TLS verification is skipped unless configured otherwise", () => {
  assert.equal(resolveConnection({}, config).tlsSkipVerify, true);
  assert.equal(resolveConnection({}, { ...config, tls: { skip_verify: false } }).tlsSkipVerify, false);
  assert.equal(resolveConnection({ KNOT_TLS_SKIP_VERIFY: "false" }, config).tlsSkipVerify, false);
  assert.equal(resolveConnection({ KNOT_TLS_SKIP_VERIFY: "true" }, { ...config, tls: { skip_verify: false } }).tlsSkipVerify, true);
});

test("the config search path matches the knot command", () => {
  assert.deepEqual(configSearchPaths("darwin", "/Users/u"), [".", "/Users/u", "/Users/u/.knot", "/Users/u/.config/knot", "/etc/knot"]);
  assert.ok(!configSearchPaths("win32", "C:\\Users\\u").some((p) => p.includes("etc")));
});

test("findConfigFile takes the first knot.toml found, or KNOT_CONFIG", () => {
  const home = mkdtempSync(join(tmpdir(), "knot-ext-"));
  mkdirSync(join(home, ".knot"));
  mkdirSync(join(home, ".config", "knot"), { recursive: true });
  writeFileSync(join(home, ".knot", "knot.toml"), "");
  writeFileSync(join(home, ".config", "knot", "knot.toml"), "");

  const paths = configSearchPaths("darwin", home).filter((p) => p !== ".");
  assert.equal(findConfigFile({}, paths), join(home, ".knot", "knot.toml"));
  assert.equal(findConfigFile({ KNOT_CONFIG: "/x/knot.toml" }, paths), "/x/knot.toml");
  assert.equal(findConfigFile({}, [join(home, "nowhere")]), undefined);
});

test("findConfigFile also finds .knot.toml, after knot.toml in the same directory", () => {
  const home = mkdtempSync(join(tmpdir(), "knot-ext-"));
  mkdirSync(join(home, ".knot"));
  writeFileSync(join(home, ".knot", ".knot.toml"), "");
  const paths = [join(home, ".knot")];
  assert.equal(findConfigFile({}, paths), join(home, ".knot", ".knot.toml"));

  writeFileSync(join(home, ".knot", "knot.toml"), "");
  assert.equal(findConfigFile({}, paths), join(home, ".knot", "knot.toml"));
});

test("an unknown alias lists the configured ones, default first", () => {
  const cfg = { client: { connection: { zeta: config.client.connection.work, ...config.client.connection, broken: { server: "x" } } } };
  assert.deepEqual(configuredAliases(cfg), ["default", "work", "zeta"]);
  assert.throws(
    () => resolveConnection({ KNOT_MCP_ALIAS: "missing" }, cfg, "/home/u/.knot/knot.toml"),
    /the aliases in \/home\/u\/\.knot\/knot\.toml are default, work, zeta/,
  );
});

