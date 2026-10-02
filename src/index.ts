import { Plugin } from '@opencode/plugin'
import { resolveConfig, parseEnvConfig, buildServeFlags, type WebPluginOptions } from './config.js'

const INIT_TIMEOUT_MS = 10_000
let hasInitialized = false

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(level: string, message: string): void {
	// V2 has no client.app.log on the plugin context; setup diagnostics go to
	// the process log.
	console.log(`[opencode-autoweb-plugin] [${level}] ${message}`)
}

/**
 * Check whether an `opencode serve` process is already running.
 * Uses async spawn + timeout to avoid blocking the event loop.
 */
async function isServeProcessRunning(port: number): Promise<boolean> {
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
					return out.toLowerCase().includes('opencode')
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

		const proc = Bun.spawn(['pgrep', '-f', `opencode serve`], {
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
		return (result ?? false) && (await isHttpUp(port, '127.0.0.1').catch(() => false))
	} catch {
		return false
	}
}

async function isHttpUp(port: number, hostname: string): Promise<boolean> {
	const host = hostname === '0.0.0.0' ? '127.0.0.1' : hostname
	for (const path of ['/global/health', '/']) {
		const res = await fetch(`http://${host}:${port}${path}`, {
			signal: AbortSignal.timeout(5000),
		}).catch(() => null)
		if (res !== null) return true
	}
	return false
}

async function isRunning(config: { port: number; hostname: string }): Promise<boolean> {
	if (await isServeProcessRunning(config.port)) return true
	return isHttpUp(config.port, config.hostname)
}

// ---------------------------------------------------------------------------
// Plugin entry point (V2 API: Plugin.define + setup)
// ---------------------------------------------------------------------------

export default Plugin.define({
	id: 'autoweb',
	async setup(ctx) {
		if (hasInitialized) return
		hasInitialized = true

		const initPromise = (async (): Promise<void> => {
			log('info', `plugin initializing (OpenCode ${ctx.app.version})`)

			const envConfig = parseEnvConfig()
			const pluginOpts = ctx.options as WebPluginOptions | undefined
			const resolvedConfig = resolveConfig(pluginOpts, envConfig)

			log(
				'debug',
				`resolved config: ${JSON.stringify({
					port: resolvedConfig.port,
					hostname: resolvedConfig.hostname,
					cors: resolvedConfig.cors,
					autoStart: resolvedConfig.autoStart,
					logLevel: resolvedConfig.logLevel,
				})}`,
			)
			await ctx.storage.set('resolved-config', {
				port: resolvedConfig.port,
				hostname: resolvedConfig.hostname,
				cors: resolvedConfig.cors ?? null,
				autoStart: resolvedConfig.autoStart,
			})

			if (!resolvedConfig.autoStart) {
				log('info', 'autoStart disabled; skipping spawn')
				return
			}

			try {
				const alreadyRunning = await isRunning(resolvedConfig)
				if (!alreadyRunning) {
					const flags = buildServeFlags(resolvedConfig)
					const proc = Bun.spawn(['opencode', 'serve', ...flags], {
						stdout: 'ignore',
						stderr: 'ignore',
						detached: true,
					})
					proc.unref()
					log(
						'info',
						`spawned opencode serve on ${resolvedConfig.hostname}:${resolvedConfig.port} (pid ${proc.pid})`,
					)
					await ctx.storage.set('spawned-pid', proc.pid)
				} else {
					log('info', `server already running on ${resolvedConfig.hostname}:${resolvedConfig.port}`)
				}
			} catch (err) {
				log('warn', `spawn check failed: ${err instanceof Error ? err.message : String(err)}`)
			}
		})()

		// Bail out after INIT_TIMEOUT_MS — the plugin is non-critical, OpenCode
		// can boot without it.
		await Promise.race([
			initPromise,
			new Promise<void>((resolve) => setTimeout(resolve, INIT_TIMEOUT_MS)),
		])

		// Detached `opencode serve` intentionally outlives OpenCode; nothing to
		// tear down on unload.
	},
})
