type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface WebPluginOptions {
	port?: number
	hostname?: string
	mdns?: boolean
	mdnsDomain?: string
	cors?: string[]
	autoStart?: boolean
	logLevel?: LogLevel
}

export interface ResolvedWebConfig {
	port: number
	hostname: string
	mdns: boolean
	mdnsDomain: string | undefined
	cors: string[] | undefined
	autoStart: boolean
	logLevel: LogLevel
}

export const DEFAULT_CONFIG: ResolvedWebConfig = {
	port: 5000,
	hostname: '127.0.0.1',
	mdns: false,
	mdnsDomain: undefined,
	cors: undefined,
	autoStart: true,
	logLevel: 'info',
}

type OpenCodeServerConfig = {
	port?: number
	hostname?: string
	mdns?: boolean
	mdnsDomain?: string
	cors?: string[]
}

type OpenCodeConfig = {
	server?: OpenCodeServerConfig
} & Record<string, unknown>

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

	const envMdns = parseBoolean(env.OPENCODE_WEB_MDNS)
	if (envMdns !== undefined) {
		config.mdns = envMdns
	}

	if (env.OPENCODE_WEB_MDNS_DOMAIN) {
		config.mdnsDomain = env.OPENCODE_WEB_MDNS_DOMAIN
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

export function getServerConfigFromOpenCodeConfig(
	config: OpenCodeConfig | undefined,
): Partial<WebPluginOptions> {
	if (!config?.server) return {}
	const s = config.server
	return {
		...(s.port !== undefined ? { port: s.port } : {}),
		...(s.hostname ? { hostname: s.hostname } : {}),
		...(s.mdns !== undefined ? { mdns: s.mdns } : {}),
		...(s.mdnsDomain ? { mdnsDomain: s.mdnsDomain } : {}),
		...(s.cors ? { cors: s.cors } : {}),
	}
}

export function resolveConfig(
	pluginOptions?: WebPluginOptions,
	envConfig?: Partial<WebPluginOptions>,
	serverConfig?: Partial<WebPluginOptions>,
): ResolvedWebConfig {
	return {
		port: pluginOptions?.port ?? envConfig?.port ?? serverConfig?.port ?? DEFAULT_CONFIG.port,
		hostname:
			pluginOptions?.hostname ??
			envConfig?.hostname ??
			serverConfig?.hostname ??
			DEFAULT_CONFIG.hostname,
		mdns: pluginOptions?.mdns ?? envConfig?.mdns ?? serverConfig?.mdns ?? DEFAULT_CONFIG.mdns,
		mdnsDomain:
			pluginOptions?.mdnsDomain ??
			envConfig?.mdnsDomain ??
			serverConfig?.mdnsDomain ??
			DEFAULT_CONFIG.mdnsDomain,
		cors: pluginOptions?.cors ?? envConfig?.cors ?? serverConfig?.cors ?? DEFAULT_CONFIG.cors,
		autoStart: pluginOptions?.autoStart ?? envConfig?.autoStart ?? DEFAULT_CONFIG.autoStart,
		logLevel: pluginOptions?.logLevel ?? envConfig?.logLevel ?? DEFAULT_CONFIG.logLevel,
	}
}

export function buildWebFlags(config: ResolvedWebConfig): string[] {
	const flags: string[] = []

	flags.push('--port', String(config.port))
	flags.push('--hostname', config.hostname)

	if (config.mdns) {
		flags.push('--mdns')
	}

	if (config.mdnsDomain) {
		flags.push('--mdns-domain', config.mdnsDomain)
	}

	if (config.cors && config.cors.length > 0) {
		for (const origin of config.cors) {
			flags.push('--cors', origin)
		}
	}

	return flags
}
