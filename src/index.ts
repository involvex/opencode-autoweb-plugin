import type { Plugin } from '@opencode-ai/plugin'
import {
	resolveConfig,
	parseEnvConfig,
	getServerConfigFromOpenCodeConfig,
	buildWebFlags,
	type WebPluginOptions,
} from './config.js'

let hasInitialized = false

async function isWebProcessRunning(port: number): Promise<boolean> {
	try {
		if (process.platform === 'win32') {
			const res = Bun.spawnSync(['cmd', '/c', 'tasklist /FI "IMAGENAME eq opencode.exe"'])
			return res.stdout.toString().includes('opencode web')
		}
		const res = Bun.spawnSync(['pgrep', '-f', `opencode web --port ${port}`])
		return res.exitCode === 0
	} catch {
		return false
	}
}

export const OpencodeAutowebPluginPlugin: Plugin = async (
	{ client },
	options?: Record<string, unknown>,
) => {
	if (hasInitialized) return {}
	hasInitialized = true

	await client.app.log({
		body: { service: 'opencode-autoweb-plugin', level: 'info', message: 'plugin initializing' },
	})

	const envConfig = parseEnvConfig()
	const pluginOpts = options as WebPluginOptions | undefined

	let openCodeConfig: Record<string, unknown> | undefined
	try {
		const result = await client.config.get()
		const raw = (result as { data?: Record<string, unknown> } | undefined)?.data
		if (raw) {
			openCodeConfig = raw
		}
	} catch {
		// proceed without OpenCode server config
	}

	const serverConfig = getServerConfigFromOpenCodeConfig(openCodeConfig)
	const resolvedConfig = resolveConfig(pluginOpts, envConfig, serverConfig)

	await client.app.log({
		body: {
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
		},
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
				await client.app.log({
					body: {
						service: 'opencode-autoweb-plugin',
						level: 'info',
						message: `spawned opencode web on ${resolvedConfig.hostname}:${resolvedConfig.port}`,
					},
				})
			} else {
				await client.app.log({
					body: {
						service: 'opencode-autoweb-plugin',
						level: 'info',
						message: `web server already running on ${resolvedConfig.hostname}:${resolvedConfig.port}`,
					},
				})
			}
		} catch {
			// silent fail
		}
	} else {
		await client.app.log({
			body: {
				service: 'opencode-autoweb-plugin',
				level: 'info',
				message: 'autoStart disabled; skipping spawn',
			},
		})
	}

	return {} as Awaited<ReturnType<Plugin>>
}

async function isRunning(config: { port: number; hostname: string }): Promise<boolean> {
	if (await isWebProcessRunning(config.port)) return true
	const res = await fetch(`http://${config.hostname}:${config.port}`).catch(() => null)
	return res !== null
}

export default OpencodeAutowebPluginPlugin
