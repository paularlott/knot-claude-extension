// Error messages for the connection to the knot server.

// describe includes the underlying cause, such as a certificate error behind
// "fetch failed".
export function describe(err, platform = process.platform) {
  const message = err.cause?.message ? `${err.message}: ${err.cause.message}` : err.message;
  // macOS blocks apps without Local Network permission from reaching hosts
  // on the local network, which surfaces as an unreachable host. Claude
  // Desktop runs the extension inside its own process with its built-in
  // Node.js, so the permission needed is Claude's; a user-installed Node.js
  // is started without it.
  if (platform === "darwin" && ["EHOSTUNREACH", "ENETUNREACH"].includes(err.cause?.code)) {
    return `${message} (if the server is on your local network, allow Claude in System Settings > Privacy & Security > Local Network and keep Claude's Use built-in Node.js for MCP setting on, then quit and reopen Claude)`;
  }
  return message;
}
