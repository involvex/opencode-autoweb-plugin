# opencode-autoweb-plugin

OpenCode (V2 API) plugin that automatically starts `opencode serve` when OpenCode launches.

Requires OpenCode v2 (`opencode --version` → `v2.x`). Built on `@opencode/plugin` (`Plugin.define` + `setup`); see the [V2 plugin docs](https://opencode.ai/v2/docs/build/plugins) and the [V1→V2 migration guide](https://opencode.ai/v2/docs/migrate-v1/).

## Installation

Add to your `opencode.json` / `opencode.jsonc` (global or per-project):

```jsonc
{
	"plugins": ["@involvex/opencode-autoweb-plugin@latest"],
}
```

OpenCode will automatically install the plugin on next launch.

## Quick Start (Global Registration)

```bash
bun run setup
```

The setup script prompts for a port and hostname, then registers the plugin with those options in your global `opencode.json` using the V2 object form (`{ "package": ..., "options": ... }`).

Then **restart OpenCode** — your plugin is live.

To remove it:

```bash
bun run unregister
```

## Configuration

The plugin resolves configuration with a 3-layer precedence: **plugin options > environment variables > defaults**.

| Option      | Type       | Default     | Description                                            |
| ----------- | ---------- | ----------- | ------------------------------------------------------ |
| `port`      | `number`   | `5000`      | Port the server listens on                             |
| `hostname`  | `string`   | `127.0.0.1` | Hostname to bind                                       |
| `cors`      | `string[]` | —           | CORS origins to allow (repeatable)                     |
| `autoStart` | `boolean`  | `true`      | Automatically spawn `opencode serve`                   |
| `logLevel`  | `string`   | `info`      | Plugin log verbosity: `debug`, `info`, `warn`, `error` |

### Plugin Options

Pass options with the V2 object form in your `opencode.jsonc`:

```jsonc
{
	"plugins": [
		{
			"package": "@involvex/opencode-autoweb-plugin@latest",
			"options": { "port": 4000, "hostname": "0.0.0.0" },
		},
	],
}
```

### Environment Variables

| Variable                 | Description                  |
| ------------------------ | ---------------------------- |
| `OPENCODE_WEB_PORT`      | Port number (1–65535)        |
| `OPENCODE_WEB_HOSTNAME`  | Hostname to bind             |
| `OPENCODE_WEB_CORS`      | Comma-separated CORS origins |
| `OPENCODE_WEB_AUTOSTART` | Enable/disable auto-start    |
| `OPENCODE_WEB_LOG_LEVEL` | Log level                    |

### What the plugin spawns

`opencode serve --hostname <hostname> --port <port> [--cors <origin> ...]`

Verify the flags on your CLI with `opencode serve --help` (v2.0.20 exposes `--hostname`, `--port`, `--cors`, plus `--service`/`--stdio`, which this plugin does not use). Pair a phone or browser with `opencode pair --url http://<lan-ip>:<port>`.

### Removed in v0.2.0 (V2 port)

- The `server.*` block from `opencode.json` is no longer read. V2 ignores the legacy `server` key (warning only), and `opencode serve` takes its own flags instead.
- `mdns` / `mdnsDomain` options and `OPENCODE_WEB_MDNS*` env vars are gone — `opencode serve` has no mDNS flags to forward.
- `client.app.log` / `client.config.get` are gone with the V1 API; setup diagnostics go to the process log and the resolved config is persisted via `ctx.storage`.

## Development

```bash
bun install
bun dev       # run OpenCode with plugin loaded from source
bun typecheck # verify types
bun check     # format, lint, typecheck
```

## Resources

- [V2 Plugin Documentation](https://opencode.ai/v2/docs/build/plugins)
- [V1→V2 Migration Guide](https://opencode.ai/v2/docs/migrate-v1/)
- [API Reference](https://opencode.ai/v2/docs/api)

## License

MIT
