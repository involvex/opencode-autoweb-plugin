import * as p from '@clack/prompts'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execSync } from 'node:child_process'

const CONFIG_DIR = join(homedir(), '.config', 'opencode')
const CONFIG_FILE = join(CONFIG_DIR, 'opencode.json')
const PLUGIN_ENTRY_PATH = resolve(dirname(import.meta.path), 'src', 'index.ts')
const PLUGIN_URL = pathToFileURL(PLUGIN_ENTRY_PATH).href

function readConfig(): Record<string, unknown> {
	if (!existsSync(CONFIG_FILE)) {
		return { $schema: 'https://opencode.ai/config.json', plugin: [] }
	}
	try {
		return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Record<string, unknown>
	} catch {
		p.log.warn(`Could not parse existing ${CONFIG_FILE} — starting with a fresh config.`)
		return { $schema: 'https://opencode.ai/config.json', plugin: [] }
	}
}

function ensureDependencies(): void {
	const projectDir = dirname(import.meta.path)
	if (!existsSync(join(projectDir, 'node_modules'))) {
		const sInstall = p.spinner()
		sInstall.start('node_modules not found — running bun install...')
		try {
			execSync('bun install', {
				cwd: projectDir,
				stdio: 'ignore',
			})
			sInstall.stop('Dependencies installed.')
		} catch {
			sInstall.stop('bun install failed. Please run it manually before setup.')
			process.exit(1)
		}
	}
}

p.intro('OpenCode Autoweb Plugin Setup')

ensureDependencies()

const config = readConfig()
const plugins: (string | [string, Record<string, unknown>])[] = Array.isArray(config.plugin)
	? (config.plugin as (string | [string, Record<string, unknown>])[])
	: []

const alreadyRegistered = plugins.some((entry) =>
	typeof entry === 'string' ? entry === PLUGIN_URL : entry[0] === PLUGIN_URL,
)

if (alreadyRegistered) {
	p.note(PLUGIN_URL, 'Already registered')
	p.outro('Plugin is already in your global OpenCode config. Nothing to do.')
	process.exit(0)
}

p.note(
	[
		`Plugin path : ${PLUGIN_ENTRY_PATH}`,
		`File URL    : ${PLUGIN_URL}`,
		`Config file : ${CONFIG_FILE}`,
	].join('\n'),
	'Will register',
)

const port = (await p.text({
	message: 'Port for the web server',
	placeholder: '5000',
	defaultValue: '5000',
	validate: (value) => {
		const n = parseInt(value ?? '', 10)
		if (isNaN(n) || n < 1 || n > 65535) return 'Must be a number between 1–65535'
		return undefined
	},
})) as string | symbol

if (p.isCancel(port)) {
	p.cancel('Setup cancelled.')
	process.exit(0)
}

const hostname = (await p.text({
	message: 'Hostname to bind',
	placeholder: '127.0.0.1',
	defaultValue: '127.0.0.1',
})) as string | symbol

if (p.isCancel(hostname)) {
	p.cancel('Setup cancelled.')
	process.exit(0)
}

const confirmed = await p.confirm({
	message: `Register with port=${String(port)} hostname=${String(hostname)}?`,
	initialValue: true,
})

if (p.isCancel(confirmed) || !confirmed) {
	p.cancel('Setup cancelled.')
	process.exit(0)
}

const sWrite = p.spinner()
sWrite.start('Writing config...')

if (!existsSync(CONFIG_DIR)) {
	mkdirSync(CONFIG_DIR, { recursive: true })
}

const opts: Record<string, unknown> = {}
const portNum = parseInt(port as string, 10)
if (portNum !== 5000) {
	opts.port = portNum
}
if (hostname !== '127.0.0.1') {
	opts.hostname = hostname
}

let pluginEntry: string | [string, Record<string, unknown>]
if (Object.keys(opts).length > 0) {
	pluginEntry = [PLUGIN_URL, opts]
} else {
	pluginEntry = PLUGIN_URL
}

config.plugin = [
	...plugins.filter((e) => !(typeof e === 'string' ? e === PLUGIN_URL : e[0] === PLUGIN_URL)),
	pluginEntry,
]
writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8')

sWrite.stop('Config updated.')

p.note(
	[
		`Registered: ${PLUGIN_URL}`,
		Object.keys(opts).length > 0 ? `Options: ${JSON.stringify(opts)}` : 'Options: defaults',
		`Config    : ${CONFIG_FILE}`,
		'',
		'Restart OpenCode for the change to take effect.',
		'To remove this plugin run: bun run unregister',
	].join('\n'),
	'Done',
)

p.outro('Setup complete!')
