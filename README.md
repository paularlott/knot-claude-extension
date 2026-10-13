# knot Claude extension

A Claude Desktop extension that connects Claude to a [knot](https://getknot.dev) server, including one on a private network that Claude's custom connectors can't reach.

The extension runs on your computer as a local MCP server and relays to the knot server's `/mcp` endpoint, so Claude gets knot's tools and skills with the same access as the API token it uses. For a knot server on the internet, you can instead add `https://<your-knot-server>/mcp` as a custom connector in Claude.

## Installing

1. Run `knot connect` to connect to your knot server, if you haven't already.
2. Download the `.mcpb` file from the [releases](https://github.com/paularlott/knot-claude-extension/releases) and open it, or drag it into **Settings → Extensions** in the Claude desktop app.
3. Choose **Install**.

The extension's settings are all optional:

| Setting | Use |
|---|---|
| Connection alias | The `knot connect` connection to use; `default` unless you set another |
| Server URL and API token | A server to use instead of a `knot connect` connection, with an API token for it; a token with only the `mcp` scope is enough |

The connection is read from `knot.toml` or `.knot.toml`, found in the same places as the `knot` command looks: the current directory, your home directory, `~/.knot/`, `~/.config/knot/` and `/etc/knot/`, or the file named by `KNOT_CONFIG`. Like the `knot` command, it accepts self-signed certificates unless `skip_verify = false` is set in the `[tls]` section of `knot.toml`.

## Development

Requires Node.js 18 or later and [Task](https://taskfile.dev).

| Task | What it does |
|---|---|
| `task build` | Bundle the relay and stage the extension in `build/` |
| `task test` | Run the unit tests |
| `task pack` | Build, test, validate and pack `dist/knot-claude-extension-<version>.mcpb` (the default task) |
| `task release` | Tag `v<version>` from `VERSION`, push the tag, and publish the `.mcpb` on the GitHub release |
| `task sync-version` | Copy the version in `VERSION` into `package.json`, `package-lock.json` and `manifest.json`; `task build` runs it too |
| `task clean` | Remove `build/` and `dist/` |

To release, set the new version in `VERSION`, run `task sync-version`, commit, then run `task release`.

## Contributing

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Contributors sign the knot [Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md), which covers all knot repositories.

## License

MIT License; see [LICENSE.txt](LICENSE.txt).
