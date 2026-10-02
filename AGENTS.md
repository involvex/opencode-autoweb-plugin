# OpenCode Plugin Development (V2)

This is an OpenCode **v2** plugin. OpenCode is an AI-powered coding assistant that runs in the terminal.

## Documentation

- [V2 Plugin Documentation](https://opencode.ai/v2/docs/build/plugins)
- [V1→V2 Migration Guide](https://opencode.ai/v2/docs/migrate-v1/)
- [API Reference](https://opencode.ai/v2/docs/api)

## Project Structure

```
src/
  index.ts    # Plugin entry point - default-exports Plugin.define({ id, setup })
  config.ts   # Option/env resolution + `opencode serve` flag builder
dev.ts        # Development script - runs OpenCode with this plugin loaded
setup.ts      # Registers the plugin in global opencode.json (V2 `plugins` + object form)
unregister.ts # Removes the plugin registration again
```

## Plugin Architecture (V2)

A plugin default-exports a definition with a stable `id`; `setup(ctx)` registers hooks, transforms, tools, and subscriptions:

```typescript
import { Plugin } from '@opencode/plugin'

export default Plugin.define({
	id: 'autoweb',
	async setup(ctx) {
		// ctx.location.directory / ctx.location.project — where this instance loaded
		// ctx.options — plugin options from the `plugins` entry in opencode.jsonc
		// ctx.storage — durable JSON state scoped to this plugin id
		// ctx.session / ctx.tool / ctx.event / ... — domain APIs (see V2 plugin docs)
	},
})
```

Rules from the migration guide that apply here:

- V1 plugin functions do not run in V2 — implementation must be ported, not just moved.
- Transforms (`ctx.tool.transform(...)`, etc.) must be synchronous, cheap, and replayable.
- `setup` may return a cleanup function; hook/transform registrations are disposed automatically.
- Manage subprocesses yourself (Bun.spawn) — there is no `$` shell helper on the context.
- Config: V2 `plugins` entries are strings or `{ package, options }` objects (no 2-tuples).

## Spawning the server

This plugin spawns `opencode serve --hostname <h> --port <p> [--cors ...]` (detached, fire-and-forget). `opencode web` no longer exists in CLI v2, and the legacy `server.*` opencode.json block is ignored by V2 — so neither is referenced.

## Development Workflow

1. Edit `src/index.ts` / `src/config.ts` to implement your plugin logic
2. Run `bun dev` to start OpenCode with your plugin loaded
3. Test your plugin by interacting with OpenCode
4. Run `bun typecheck` to verify types

## Logging

V2 has no `client.app.log` on the plugin context — use the process log:

```typescript
console.log(`[opencode-autoweb-plugin] spawned opencode serve on ${host}:${port}`)
```

## Publishing

1. Update `package.json` with your plugin name, description, and repository
2. Run `npm publish`
3. Users install by adding to their `opencode.jsonc`:

```jsonc
{
	"plugins": ["your-plugin-name@latest"],
}
```
