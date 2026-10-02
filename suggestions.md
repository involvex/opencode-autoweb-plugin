# Suggestions for `opencode-autoweb-plugin`

> V2 note (v0.2.0 port): this doc was written against the V1 plugin API. When
> implementing items below, use the V2 equivalents — `ctx.tool.transform(...)`
> instead of the `tool` helper/`tool` return block, `ctx.session.hook(...)` /
> `ctx.tool.hook(...)` / `ctx.shell.hook(...)` / `ctx.permission.hook(...)`
> instead of `chat.*`/`tool.execute.*`/`shell.env`/`permission.ask` string keys,
> `ctx.command.transform(...)` instead of `command.execute.before`,
> `ctx.event.subscribe()` instead of the `event` return hook, a cleanup function
> returned from `setup` instead of `dispose`, and `Plugin.define` from
> `@opencode/plugin` (not `@opencode-ai/plugin`). The spawned command is
> `opencode serve`, not `opencode serve`.

This document outlines features that can be implemented to extend the plugin beyond its current minimal scope (auto-spawning `opencode serve --port 5000`). Each suggestion includes a rationale and implementation notes.

---

## 1. Configure the Web Server Port

**Rationale:** The port is currently hardcoded to `5000`. Different users or CI environments may need a different port to avoid conflicts.

**Implementation:** Read the port from an environment variable (`OPENCODE_WEB_PORT`) or from OpenCode's config. Fall back to `5000`.

**Hook/Area:** `src/index.ts` spawn logic; could also use the `config` hook to inspect loaded config.

---

## 2. Custom Tool: `web.status`

**Rationale:** Once the web server is running, users should be able to query its status directly from OpenCode chat — a custom tool is the idiomatic way to expose this.

**Implementation:** Register a custom `tool` (using `ctx.tool.transform` from `@opencode/plugin`) that checks whether the process is alive and the port is responding, then returns a human-readable summary.

**Example return:** `"OpenCode web server is running on http://127.0.0.1:5000 (PID 1234)"` or an error if not reachable.

**Hook/Area:** `tool` return block from the plugin.

---

## 3. Custom Tool: `web.restart`

**Rationale:** There is no way to restart the web server without leaving OpenCode and running shell commands manually. A `/web.restart`-style tool (or slash command) would streamline troubleshooting.

**Implementation:** A custom `tool` that kills any existing `opencode serve` process and spawns a fresh one, reusing the port-detection logic from the main plugin. Could call into a shared `startWebServer()` helper.

**Hook/Area:** `tool` return block; share logic via a helper function.

---

## 4. Custom Tool: `web.url`

**Rationale:** Return the actual URL the web server is reachable at — useful in containerized or remote-dev setups where the host differs from `127.0.0.1`.

**Implementation:** Check config/`OPENCODE_WEB_HOST` env var; default to `localhost`. Return the full URL. Optionally probe a few common hostnames if `localhost` fails.

**Hook/Area:** `tool` return block.

---

## 5. Auto-Cleanup on Plugin Dispose

**Rationale:** Currently, the `opencode serve` process is spawned with `detached: true` and is never explicitly killed when the plugin (or OpenCode) shuts down. This can leave orphan processes.

**Implementation:** Use the `dispose` hook to terminate any `opencode serve` process that this plugin spawned. Track the spawned `Subprocess` object (instead of firing-and-forgetting) and kill it in `dispose`.

**Hook/Area:** `dispose`

---

## 6. Log to OpenCode App Log When Web Server Starts/Stops

**Rationale:** Right now logging is limited to plugin initialization. It would be valuable to emit log entries when the web server actually starts, fails to start, or is detected as already running on startup.

**Implementation:** Wrap the spawn/port-check logic in try/catch blocks and emit `client.app.log(...)` entries for each outcome (started, already-running, failed-to-start).

**Hook/Area:** `client.app.log` in `src/index.ts`.

---

## 7. Slash Command: `/web`

**Rationale:** OpenCode supports slash commands intercepted via the `command.execute.before` hook. A `/web` command (with subcommands like `status`, `restart`, `open`) would provide a natural CLI interaction alongside the custom tools.

**Implementation:** Intercept `command.execute.before` for commands beginning with `/web`. Subcommands:

- `/web status` — check if running and show URL
- `/web restart` — restart the server
- `/web open` — attempt to open the URL in the default browser

**Hook/Area:** `command.execute.before`

---

## 8. Permission Auto-Allow for `read`/`write` on Web Server Config

**Rationale:** If the plugin reads/writes config files (e.g., to persist the chosen port), it should pre-approve its own file access so it never prompts the user unnecessarily.

**Implementation:** In the `permission.ask` hook, auto-allow permission requests for files the plugin owns (e.g., a `.opencode-web-config.json` file in the project root or config dir).

**Hook/Area:** `permission.ask`

---

## 9. Environment Variable Injection for Downstream Tools

**Rationale:** Child shells spawned by OpenCode should be aware of the auto-started web server (e.g., `OPENCODE_WEB_URL=http://127.0.0.1:5000`) so other tools/scripts can reference it without re-scanning.

**Implementation:** Use the `shell.env` hook to inject `OPENCODE_WEB_URL` into every shell environment.

**Hook/Area:** `shell.env`

---

## 10. Configurable via Plugin Options

**Rationale:** OpenCode plugins can accept options (see `PluginOptions` in the SDK). Instead of hardcoding behavior, allow users to configure:

- `port` (default 5000)
- `host` (default `127.0.0.1`)
- `autoStart` (default `true`)
- `logLevel` (default `info`)

**Implementation:** The plugin function signature already supports `(input: PluginInput, options?: PluginOptions) => Promise<Hooks>`. Parse `options` and store values in module-level variables for use by hooks/tools. Users pass options in `opencode.json`:

```json
{
	"plugin": [["opencode-autoweb-plugin", { "port": 8080, "host": "0.0.0.0" }]]
}
```

**Hook/Area:** Plugin entry function + options parsing.

---

## 11. Health-Check Polling & Retry

**Rationale:** The web server may take a moment to bind. Currently the port is checked once; if it's not ready yet the plugin assumes it isn't running and may spawn a duplicate.

**Implementation:** After spawning, poll the port with short retries (e.g., 5 attempts, 500 ms apart) and update the "is running" state accordingly. Store the readiness state so custom tools can return accurate info.

**Hook/Area:** `src/index.ts` spawn logic + a shared readiness flag consumed by tools/hooks.

---

## 12. Cross-Platform Notification When Web Server is Ready

**Rationale:** When running locally with `bun dev` or in an interactive session, the user should get an OS-level notification that the web server is up and reachable.

**Implementation:** After the health check succeeds, fire a transient notification:

- **macOS:** `osascript -e 'display notification "..."'`
- **Windows:** Powershell `New-BurntToastNotification` or a simpler `msg` command
- **Linux:** `notify-send`

Keep it best-effort (silent fail if the command isn't available).

**Hook/Area:** `src/index.ts` post-spawn; could be triggered from a session-idle event hook.

---

## 13. Event Hook: React to Session Idle

**Rationale:** The `event` hook can subscribe to OpenCode events like `session.idle`. When a coding session goes idle and the web server is not running, the plugin could auto-start it (lazy startup rather than eager startup on plugin load).

**Implementation:** In the `event` hook, check `event.type === 'session.idle'` and if the web process isn't running, spawn it then. This defers resource usage until actually needed.

**Hook/Area:** `event`

---

## 14. `tool.execute.after` — Capture Web Server Logs to File

**Rationale:** For debugging, capture stdout/stderr of the spawned `opencode serve` process to a log file (e.g., `~/.config/opencode/web-server.log`) so users can inspect web-server errors without re-running manually.

**Implementation:** When spawning, pipe `stdout`/`stderr` to a file in append mode instead of `'ignore'`. Rotate the log on each start or cap at a max size.

**Hook/Area:** `src/index.ts` spawn options.

---

## 15. Expose Web Server Info via `chat.params` or Headers

**Rationale:** If the web server's URL changes (configurable port), the LLM context could carry that metadata as a custom header on every LLM request, making it available to prompt templates that know how to read it.

**Implementation:** Use the `chat.headers` hook to add `x-opencode-web-url: http://127.0.0.1:<port>` to every LLM request header.

**Hook/Area:** `chat.headers`

---

## 16. `experimental.text.complete` — Surface Web URL When Mentioned

**Rationale:** As a lightweight "smart assist" feature, if the user's last AI response text contains the phrase "web server" or "open the web UI", the plugin could append the actual URL as a follow-up note.

**Implementation:** In `experimental.text.complete`, inspect `output.text`. If it matches a pattern, append `"\n\nWeb UI: http://127.0.0.1:5000"` to the text (or log it via the TUI toast).

**Hook/Area:** `experimental.text.complete`

---

## 17. Workspace Adapter for Web Projects

**Rationale:** The `experimental_workspace.register` API lets plugins register workspace adapters — handlers that can create/configure project workspaces. For a web-server-focused plugin, a workspace adapter could scaffold a minimal HTML project that proxies or embeds the OpenCode web UI.

**Implementation:** Register a workspace adapter under a type like `"opencode-web"` in the `PluginInput.experimental_workspace.register(...)` callback. The adapter's `configure`/`create` methods would scaffold a small `index.html` that loads the web UI in an iframe.

**Hook/Area:** `PluginInput.experimental_workspace` (available in the plugin input).

---

## 18. Provider Hook for a "Web" Model Alias

**Rationale:** The `provider` hook lets plugins declare a model provider and its models. A fun/novel use: register a synthetic provider named "opencode-web" that maps to the locally running web server's capabilities. This would show the web UI as a selectable "model" or provider in the OpenCode model picker.

**Implementation:** Return a `provider` hook:

```typescript
provider: {
  id: 'opencode-web',
  models: async (provider, ctx) => ({
    'web-ui': {
      id: 'web-ui',
      name: 'OpenCode Web UI',
      provider,
      // ... minimal model metadata
    },
  }),
}
```

**Hook/Area:** `provider`

---

## 19. Auth Hook for Web UI Session Token

**Rationale:** If the web server requires authentication (e.g., behind a reverse proxy with a token), the plugin could implement an OAuth-like auth flow that issues a session token the web UI reads.

**Implementation:** Return an `auth` hook with a custom provider (e.g. `"opencode-web-token"`) using the `"api"` method that prompts for a token and stores it. The `web.url` tool could then optionally include `?token=...`.

**Hook/Area:** `auth`

---

## 20. `tool.definition` Hook — Hide or Augment Built-in Tools

**Rationale:** If the web server is running, the plugin could augment the description of built-in tools (e.g., adding a note to the `bash`/`shell` tool that output is also streamed to the web UI) or hide tools that are redundant when using the web interface.

**Implementation:** Use the `tool.definition` hook to inspect `input.toolID` and modify `output.description` to append web-context notes.

**Hook/Area:** `tool.definition`

---

## 21. Session Message Listener — Mirror Chat to Web UI

**Rationale:** For observability, every user message could be mirrored to a log file or pushed to the web server's own log endpoint so the web UI shows a history of interactions even if started after the session.

**Implementation:** Use the `chat.message` hook to capture `input.sessionID` and `output.parts`, then append a structured entry to `~/.config/opencode/web-chat.log`.

**Hook/Area:** `chat.message`

---

## 22. `chat.system.transform` — Add Web UI Context to System Prompt

**Rationale:** Optionally inform the LLM that a web UI is available (with the actual URL) so it can proactively suggest "Open this in your browser" to the user when relevant.

**Implementation:** In `experimental.chat.system.transform`, append a short line like:

> "A live web UI for this session is available at http://127.0.0.1:5000 — mention it to the user when it would help."

Controlled via a plugin option (e.g. `injectSystemPrompt: true`, default `false`).

**Hook/Area:** `experimental.chat.system.transform`

---

## 23. Project-Specific Port from `AGENTS.md` or `.opencode-web.json`

**Rationale:** Different projects may benefit from different ports. Allow per-project override by reading a config file from the project root.

**Implementation:** In the plugin entry (or `config` hook), check for `AGENTS.md` annotations or a `.opencode-web.json` file containing `{ "port": 8080 }`. Use that port if present.

**Hook/Area:** Plugin entry + `config` hook.

---

## Summary Table

| #   | Feature                       | Hook(s)                              | Effort |
| --- | ----------------------------- | ------------------------------------ | ------ |
| 1   | Configurable port             | — (entry logic)                      | Low    |
| 2   | `web.status` custom tool      | `tool`                               | Low    |
| 3   | `web.restart` custom tool     | `tool`                               | Low    |
| 4   | `web.url` custom tool         | `tool`                               | Low    |
| 5   | Auto-cleanup on dispose       | `dispose`                            | Low    |
| 6   | Log web server lifecycle      | `client.app.log`                     | Low    |
| 7   | `/web` slash command          | `command.execute.before`             | Medium |
| 8   | Auto-allow config file access | `permission.ask`                     | Low    |
| 9   | Inject `OPENCODE_WEB_URL`     | `shell.env`                          | Low    |
| 10  | Plugin options support        | entry function signature             | Low    |
| 11  | Health-check retry            | — (entry logic)                      | Low    |
| 12  | OS notification on ready      | — (entry logic / `event`)            | Low    |
| 13  | Lazy start on session idle    | `event`                              | Medium |
| 14  | Capture web server logs       | — (spawn options)                    | Low    |
| 15  | Inject web URL header         | `chat.headers`                       | Low    |
| 16  | Append URL on mention         | `experimental.text.complete`         | Low    |
| 17  | Workspace adapter             | `experimental_workspace.register`    | Medium |
| 18  | "Web" model alias             | `provider`                           | Medium |
| 19  | Auth token for web UI         | `auth`                               | Medium |
| 20  | Augment tool descriptions     | `tool.definition`                    | Low    |
| 21  | Mirror chat to web log        | `chat.message`                       | Medium |
| 22  | Inject web context in system  | `experimental.chat.system.transform` | Low    |
| 23  | Per-project port override     | `config` hook                        | Medium |
