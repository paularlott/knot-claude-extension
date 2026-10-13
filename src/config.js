// Connection resolution, matching the knot command's `knot mcp`: an explicit
// server and token, else the alias section of knot.toml written by
// `knot connect`.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";

const CONFIG_FILE = "knot.toml";
const ALIAS_RE = /^[a-zA-Z][a-zA-Z0-9-]{0,19}$/;

// setting returns an extension setting from the environment, or undefined
// when it is blank or left unsubstituted by a host that doesn't fill in
// blank optional settings (the literal "${user_config.x}").
export function setting(env, name) {
  const value = (env[name] ?? "").trim();
  if (value === "" || value.startsWith("${")) {
    return undefined;
  }
  return value;
}

// configSearchPaths returns the directories searched for knot.toml, in the
// same order as the knot command.
export function configSearchPaths(platform = process.platform, home = homedir()) {
  const paths = ["."];
  if (home) {
    paths.push(home, join(home, ".knot"), join(home, ".config", "knot"));
  }
  if (platform !== "win32") {
    paths.push(join("/etc", "knot"));
  }
  return paths;
}

// findConfigFile returns the knot.toml to use: KNOT_CONFIG when set, else
// the first knot.toml or .knot.toml found on the search path, as the knot
// command looks for them.
export function findConfigFile(env = process.env, paths = configSearchPaths()) {
  const explicit = setting(env, "KNOT_CONFIG");
  if (explicit) {
    return explicit;
  }
  for (const dir of paths) {
    for (const name of [CONFIG_FILE, `.${CONFIG_FILE}`]) {
      const file = join(dir, name);
      if (existsSync(file)) {
        return file;
      }
    }
  }
  return undefined;
}

export function loadConfig(file) {
  if (!file) {
    return {};
  }
  try {
    return parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`couldn't read ${file}: ${err.message}`);
  }
}

// mcpEndpoint returns a knot server's MCP endpoint, given either the
// server's address or the endpoint's own URL.
export function mcpEndpoint(server) {
  return server.replace(/\/+$/, "").replace(/\/mcp$/, "") + "/mcp";
}

function parseBool(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["1", "t", "true", "yes"].includes(v)) return true;
    if (["0", "f", "false", "no"].includes(v)) return false;
  }
  return undefined;
}

// resolveConnection works out the server, token and TLS behaviour from the
// extension's settings and knot.toml.
export function resolveConnection(env = process.env, config = {}, configFile = undefined) {
  // Like the knot command, certificates aren't verified unless knot.toml
  // or KNOT_TLS_SKIP_VERIFY says otherwise.
  const tlsSkipVerify =
    parseBool(setting(env, "KNOT_TLS_SKIP_VERIFY")) ?? parseBool(config.tls?.skip_verify) ?? true;

  const server = setting(env, "KNOT_SERVER");
  const token = setting(env, "KNOT_TOKEN");
  if (server && token) {
    return { server, token, endpoint: mcpEndpoint(server), tlsSkipVerify };
  }

  const alias = setting(env, "KNOT_MCP_ALIAS") ?? "default";
  const connection = ALIAS_RE.test(alias) ? config.client?.connection?.[alias] : undefined;
  if (typeof connection?.server === "string" && connection.server && typeof connection?.token === "string" && connection.token) {
    return { server: connection.server, token: connection.token, endpoint: mcpEndpoint(connection.server), tlsSkipVerify };
  }

  const aliases = configuredAliases(config);
  const known = aliases.length ? `; the aliases in ${configFile ?? "knot.toml"} are ${aliases.join(", ")}` : "";
  throw new Error(
    `no server configured for alias "${alias}"${known} (run 'knot connect' first, or set the server URL and API token in the extension's settings)`,
  );
}

// configuredAliases returns the aliases with a server and token in
// knot.toml, default first.
export function configuredAliases(config = {}) {
  const connections = config.client?.connection ?? {};
  const aliases = Object.keys(connections).filter(
    (alias) => typeof connections[alias]?.server === "string" && connections[alias].server && typeof connections[alias]?.token === "string" && connections[alias].token,
  );
  return aliases.sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b)));
}
