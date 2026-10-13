// knot Claude extension: a stdio MCP server for Claude Desktop that relays
// to a knot server's /mcp endpoint, so it works with servers Claude can't
// reach itself, such as ones on a private network.
//
// Stdout is the MCP protocol; diagnostics go to stderr, which Claude
// Desktop writes to its mcp-server-knot.log.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  CompleteRequestSchema,
  CompleteResultSchema,
  GetPromptRequestSchema,
  GetPromptResultSchema,
  ListPromptsRequestSchema,
  ListPromptsResultSchema,
  ListResourcesRequestSchema,
  ListResourcesResultSchema,
  ListResourceTemplatesRequestSchema,
  ListResourceTemplatesResultSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
  PromptListChangedNotificationSchema,
  ReadResourceRequestSchema,
  ReadResourceResultSchema,
  ResourceListChangedNotificationSchema,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { findConfigFile, loadConfig, resolveConnection } from "./config.js";
import { describe } from "./errors.js";

const NAME = "knot";
// __VERSION__ is set from package.json when bundled.
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

// Tool calls such as run_command can run for a while; progress from the
// server keeps them alive.
const REQUEST_OPTIONS = { timeout: 10 * 60 * 1000, resetTimeoutOnProgress: true };

function log(message) {
  process.stderr.write(`knot: ${message}\n`);
}

async function connectUpstream(connection) {
  if (connection.tlsSkipVerify) {
    // The relay talks only to the knot server, so this applies to it alone.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const client = new Client({ name: "knot-claude-extension", version: VERSION });
  const transport = new StreamableHTTPClientTransport(new URL(connection.endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${connection.token}` } },
  });

  try {
    await client.connect(transport);
  } catch (err) {
    throw new Error(
      `couldn't connect to the MCP endpoint at ${connection.endpoint} (check that MCP is enabled on the server, server.mcp.enabled, and that the API token can use it): ${describe(err)}`,
    );
  }
  return client;
}

// relay serves the knot server's capabilities and instructions on stdio,
// forwarding each request to it unchanged.
function relay(client) {
  const upstream = client.getServerCapabilities() ?? {};
  const capabilities = {};
  if (upstream.tools) capabilities.tools = { listChanged: true };
  if (upstream.resources) capabilities.resources = { listChanged: true };
  if (upstream.prompts) capabilities.prompts = { listChanged: true };
  if (upstream.completions) capabilities.completions = {};

  const server = new Server(
    { name: NAME, version: VERSION },
    { capabilities, instructions: client.getInstructions() },
  );

  const forward = (requestSchema, resultSchema) => {
    server.setRequestHandler(requestSchema, (request) =>
      client.request({ method: request.method, params: request.params }, resultSchema, REQUEST_OPTIONS),
    );
  };

  if (capabilities.tools) {
    forward(ListToolsRequestSchema, ListToolsResultSchema);
    forward(CallToolRequestSchema, CallToolResultSchema);
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => server.sendToolListChanged());
  }
  if (capabilities.resources) {
    forward(ListResourcesRequestSchema, ListResourcesResultSchema);
    forward(ListResourceTemplatesRequestSchema, ListResourceTemplatesResultSchema);
    forward(ReadResourceRequestSchema, ReadResourceResultSchema);
    client.setNotificationHandler(ResourceListChangedNotificationSchema, () => server.sendResourceListChanged());
  }
  if (capabilities.prompts) {
    forward(ListPromptsRequestSchema, ListPromptsResultSchema);
    forward(GetPromptRequestSchema, GetPromptResultSchema);
    client.setNotificationHandler(PromptListChangedNotificationSchema, () => server.sendPromptListChanged());
  }
  if (capabilities.completions) {
    forward(CompleteRequestSchema, CompleteResultSchema);
  }

  return server;
}

async function main() {
  const configFile = findConfigFile();
  const connection = resolveConnection(process.env, loadConfig(configFile), configFile);
  const client = await connectUpstream(connection);
  const server = relay(client);

  const shutdown = async () => {
    await client.close().catch(() => {});
    process.exit(0);
  };
  server.onclose = shutdown;
  // The host closing stdin ends the session; the open stream to the knot
  // server would otherwise keep the process alive.
  process.stdin.on("end", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.connect(new StdioServerTransport());
  log(`relaying to ${connection.endpoint}${configFile ? ` (config ${configFile})` : ""}`);
}

main().catch((err) => {
  log(`Error: ${err.message}`);
  process.exit(1);
});
