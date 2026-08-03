# opencode-autoweb-plugin

OpenCode plugin (minimal).

## Installation

Add to your `opencode.json` (global or per-project):

```json
{
	"plugin": ["opencode-autoweb-plugin@latest"]
}
```

OpenCode will automatically install the plugin on next launch.

## Quick Start (Global Registration)

```bash
bun run setup
```

Then **restart OpenCode** — your plugin is live.

To remove it:

```bash
bun run unregister
```

## Development

```bash
bun install
bun dev       # run OpenCode with plugin loaded from source
bun typecheck # verify types
bun check     # format, lint, typecheck
```

## Included Hooks

This minimal template includes:

- **`tool.greet`** — A custom tool that greets a person by name
- **`tool.execute.before`** — Blocks reading `.env` files
- **`event`** — Logs when a session completes

## Resources

- [Plugin Documentation](https://opencode.ai/docs/plugins/)
- [SDK Reference](https://opencode.ai/docs/sdk/)
- [Community Plugins](https://opencode.ai/docs/ecosystem/#plugins)

## License

MIT
