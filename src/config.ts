type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface WebPluginOptions {
	port?: number
	hostname?: string
	cors?: string[]
	autoStart?: boolean
	logLevel?: LogLevel
}

export interface ResolvedWebConfig {
	port: number
	hostname: string
	cors: string[] | undefined
	autoStart: boolean
	logLevel: LogLevel
}

export const DEFAULT_CONFIG: ResolvedWebConfig = {
	port: 5000,
	hostname: '127.0.0.1',
	cors: undefined,
	autoStart: true,
	logLevel: 'info',
}

function parseBoolean(value: string | undefined): boolean | undefined {
	if (value === undefined) return undefined
	const lower = value.toLowerCase().trim()
	if (['1', 'true', 'yes', 'on'].includes(lower)) return true
	if (['0', 'false', 'no', 'off'].includes(lower)) return false
	return undefined
}

export function parseEnvConfig(): Partial<WebPluginOptions> {
	const config: Partial<WebPluginOptions> = {}
	const env = process.env

	if (env.OPENCODE_WEB_PORT) {
		const port = parseInt(env.OPENCODE_WEB_PORT, 10)
		if (!isNaN(port) && port > 0 && port <= 65535) {
			config.port = port
		}
	}

	if (env.OPENCODE_WEB_HOSTNAME) {
		config.hostname = env.OPENCODE_WEB_HOSTNAME
	}

	if (env.OPENCODE_WEB_CORS) {
		config.cors = env.OPENCODE_WEB_CORS.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	}

	const envAutoStart = parseBoolean(env.OPENCODE_WEB_AUTOSTART)
	if (envAutoStart !== undefined) {
		config.autoStart = envAutoStart
	}

	if (env.OPENCODE_WEB_LOG_LEVEL) {
		const level = env.OPENCODE_WEB_LOG_LEVEL as string
		if (['debug', 'info', 'warn', 'error'].includes(level)) {
			config.logLevel = level as LogLevel
		}
	}

	return config
}

/**
 * Resolve the effective config.
 *
 * Precedence: plugin options > OPENCODE_WEB_* env > defaults.
 *
 * V2 note: the V1 `server.*` block from opencode.json is intentionally NOT
 * read. V2 treats `server` as an unsupported legacy field (it is ignored with
 * a warning), and `opencode serve` takes its own --hostname/--port/--cors
 * flags instead. Likewise the V1 mdns/mdnsDomain options are gone: `opencode
 * serve` (v2.0.20) exposes only --hostname, --port, --cors (+ --service,
 * --stdio), so there is no mDNS flag to forward.
 */
export function resolveConfig(
	pluginOptions?: WebPluginOptions,
	envConfig?: Partial<WebPluginOptions>,
): ResolvedWebConfig {
	return {
		port: pluginOptions?.port ?? envConfig?.port ?? DEFAULT_CONFIG.port,
		hostname: pluginOptions?.hostname ?? envConfig?.hostname ?? DEFAULT_CONFIG.hostname,
		cors: pluginOptions?.cors ?? envConfig?.cors ?? DEFAULT_CONFIG.cors,
		autoStart: pluginOptions?.autoStart ?? envConfig?.autoStart ?? DEFAULT_CONFIG.autoStart,
		logLevel: pluginOptions?.logLevel ?? envConfig?.logLevel ?? DEFAULT_CONFIG.logLevel,
	}
}

/** Build argv for `opencode serve --hostname <h> --port <p> [--cors ...]`. */
export function buildServeFlags(config: ResolvedWebConfig): string[] {
	const flags: string[] = []

	flags.push('--hostname', config.hostname)
	flags.push('--port', String(config.port))

	if (config.cors && config.cors.length > 0) {
		for (const origin of config.cors) {
			flags.push('--cors', origin)
		}
	}

	return flags
}
