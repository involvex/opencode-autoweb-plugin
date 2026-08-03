# opencode-autoweb-plugin

OpenCode plugin that automatically starts `opencode web` when OpenCode launches.

## Installation

Add to your `opencode.json` (global or per-project):

```json
{
	"plugin": ["@involvex/opencode-autoweb-plugin@latest"]
}
```

OpenCode will automatically install the plugin on next launch.

## Quick Start (Global Registration)

```bash
bun run setup
```

The setup script will prompt you for a port and hostname, then register the plugin with those options in your global `opencode.json`.

Then **restart OpenCode** — your plugin is live.

To remove it:

```bash
bun run unregister
```

## Configuration

The plugin resolves configuration with a 3-layer precedence: **plugin options > environment variables > OpenCode server config > defaults**.

| Option       | Type       | Default     | Description                             |
| ------------ | ---------- | ----------- | --------------------------------------- |
| `port`       | `number`   | `5000`      | Port the web server listens on          |
| `hostname`   | `string`   | `127.0.0.1` | Hostname to bind                        |
| `mdns`       | `boolean`  | `false`     | Enable mDNS advertisement               |
| `mdnsDomain` | `string`   | —           | Custom mDNS domain                      |
| `cors`       | `string[]` | —           | CORS origins to allow                   |
| `autoStart`  | `boolean`  | `true`      | Automatically spawn `opencode web`      |
| `logLevel`   | `string`   | `info`      | One of `debug`, `info`, `warn`, `error` |

### Plugin Options

Pass options as a 2-tuple in your `opencode.json`:

```json
{
	"plugin": [["@involvex/opencode-autoweb-plugin@latest", { "port": 8080, "hostname": "0.0.0.0" }]]
}
```

### Environment Variables

| Variable                   | Description                                                        |
| -------------------------- | ------------------------------------------------------------------ |
| `OPENCODE_WEB_PORT`        | Port number (1–65535)                                              |
| `OPENCODE_WEB_HOSTNAME`    | Hostname to bind                                                   |
| `OPENCODE_WEB_MDNS`        | Enable mDNS (`1`, `true`, `yes`, `on` / `0`, `false`, `no`, `off`) |
| `OPENCODE_WEB_MDNS_DOMAIN` | Custom mDNS domain                                                 |
| `OPENCODE_WEB_CORS`        | Comma-separated CORS origins                                       |
| `OPENCODE_WEB_AUTOSTART`   | Enable/disable auto-start                                          |
| `OPENCODE_WEB_LOG_LEVEL`   | Log level                                                          |

### OpenCode Server Config

If you have a `server` block in your OpenCode config, the plugin reads `port`, `hostname`, `mdns`, `mdnsDomain`, and `cors` from it as a fallback source.

## Development

```bash
bun install
bun dev       # run OpenCode with plugin loaded from source
bun typecheck # verify types
bun check     # format, lint, typecheck
```

## Resources

- [Plugin Documentation](https://opencode.ai/docs/plugins/)
- [SDK Reference](https://opencode.ai/docs/sdk/)
- [Community Plugins](https://opencode.ai/docs/ecosystem/#plugins)

## License

MIT
