import type { Plugin } from '@opencode-ai/plugin'
import {
	resolveConfig,
	parseEnvConfig,
	getServerConfigFromOpenCodeConfig,
	buildWebFlags,
	type WebPluginOptions,
} from './config.js'

const INIT_TIMEOUT_MS = 10_000
let hasInitialized = false

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fire-and-forget log via the SDK client — never blocks init. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeLog(client: any, body: Record<string, unknown>): void {
	client.app.log({ body }).catch(() => {})
}

/**
 * Check whether an `opencode web` process is already running.
 * Uses async spawn + timeout to avoid blocking the event loop.
 */
async function isWebProcessRunning(port: number): Promise<boolean> {
	try {
		if (process.platform === 'win32') {
			const proc = Bun.spawn(['cmd', '/c', 'tasklist /FI "IMAGENAME eq opencode.exe"'], {
				stdout: 'pipe',
				stderr: 'pipe',
			})
			const result = await Promise.race([
				(async (): Promise<boolean> => {
					const out = await new Response(proc.stdout).text()
					await proc.exited
					return out.includes('opencode web')
				})(),
				new Promise<boolean>((resolve) =>
					setTimeout(() => {
						proc.kill()
						resolve(false)
					}, 5000),
				),
			])
			return result ?? false
		}

		const proc = Bun.spawn(['pgrep', '-f', `opencode web --port ${port}`], {
			stdout: 'pipe',
			stderr: 'pipe',
		})
		const result = await Promise.race([
			proc.exited.then(() => proc.exitCode === 0),
			new Promise<boolean>((resolve) =>
				setTimeout(() => {
					proc.kill()
					resolve(false)
				}, 5000),
			),
		])
		return result ?? false
	} catch {
		return false
	}
}

async function isRunning(config: { port: number; hostname: string }): Promise<boolean> {
	if (await isWebProcessRunning(config.port)) return true
	const res = await fetch(`http://${config.hostname}:${config.port}`, {
		signal: AbortSignal.timeout(5000),
	}).catch(() => null)
	return res !== null
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export const OpencodeAutowebPluginPlugin: Plugin = async (
	{ client },
	options?: Record<string, unknown>,
) => {
	if (hasInitialized) return {}
	hasInitialized = true

	const initPromise = (async (): Promise<void> => {
		safeLog(client, {
			service: 'opencode-autoweb-plugin',
			level: 'info',
			message: 'plugin initializing',
		})

		const envConfig = parseEnvConfig()
		const pluginOpts = options as WebPluginOptions | undefined

		// Fetch OpenCode config with a timeout so a slow IPC doesn't hang boot.
		let openCodeConfig: Record<string, unknown> | undefined
		try {
			const result = await Promise.race([
				client.config.get(),
				new Promise<undefined>((resolve) => setTimeout(resolve, 5000, undefined)),
			])
			const raw = (result as { data?: Record<string, unknown> } | undefined)?.data
			if (raw) openCodeConfig = raw
		} catch {
			// proceed without OpenCode server config
		}

		const serverConfig = getServerConfigFromOpenCodeConfig(openCodeConfig)
		const resolvedConfig = resolveConfig(pluginOpts, envConfig, serverConfig)

		safeLog(client, {
			service: 'opencode-autoweb-plugin',
			level: 'debug',
			message: `resolved config: ${JSON.stringify({
				port: resolvedConfig.port,
				hostname: resolvedConfig.hostname,
				mdns: resolvedConfig.mdns,
				mdnsDomain: resolvedConfig.mdnsDomain,
				cors: resolvedConfig.cors,
				autoStart: resolvedConfig.autoStart,
				logLevel: resolvedConfig.logLevel,
			})}`,
		})

		if (resolvedConfig.autoStart) {
			try {
				const alreadyRunning = await isRunning(resolvedConfig)
				if (!alreadyRunning) {
					const flags = buildWebFlags(resolvedConfig)
					Bun.spawn(['opencode', 'web', ...flags], {
						stdout: 'ignore',
						stderr: 'ignore',
						detached: true,
					})
					safeLog(client, {
						service: 'opencode-autoweb-plugin',
						level: 'info',
						message: `spawned opencode web on ${resolvedConfig.hostname}:${resolvedConfig.port}`,
					})
				} else {
					safeLog(client, {
						service: 'opencode-autoweb-plugin',
						level: 'info',
						message: `web server already running on ${resolvedConfig.hostname}:${resolvedConfig.port}`,
					})
				}
			} catch {
				// silent fail
			}
		} else {
			safeLog(client, {
				service: 'opencode-autoweb-plugin',
				level: 'info',
				message: 'autoStart disabled; skipping spawn',
			})
		}
	})()

	// Bail out after INIT_TIMEOUT_MS — the plugin is non-critical, OpenCode
	// can boot without it.
	await Promise.race([
		initPromise,
		new Promise<void>((resolve) => setTimeout(resolve, INIT_TIMEOUT_MS)),
	])

	return {} as Awaited<ReturnType<Plugin>>
}

export default OpencodeAutowebPluginPlugin
