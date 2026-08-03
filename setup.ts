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
	if (!existsSync(join(dirname(import.meta.path), 'node_modules'))) {
		const sInstall = p.spinner()
		sInstall.start('node_modules not found — running bun install...')
		try {
			execSync('bun install', {
				cwd: dirname(import.meta.path),
				stdio: 'ignore',
			})
			sInstall.stop('Dependencies installed.')
		} catch {
			sInstall.stop('bun install failed. Please run it manually before setup.')
			process.exit(1)
		}
	}
}

p.intro('OpenCode Plugin Setup')

ensureDependencies()

const config = readConfig()
const plugins: string[] = Array.isArray(config.plugin) ? (config.plugin as string[]) : []

if (plugins.includes(PLUGIN_URL)) {
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

const confirmed = await p.confirm({
	message: `Add this plugin to ${CONFIG_FILE}?`,
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

config.plugin = [...plugins, PLUGIN_URL]
writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8')

sWrite.stop('Config updated.')

p.note(
	[
		`✓ Registered: ${PLUGIN_URL}`,
		`✓ Config    : ${CONFIG_FILE}`,
		'',
		'Restart OpenCode for the change to take effect.',
		'To remove this plugin run: bun run unregister',
	].join('\n'),
	'Done',
)

p.outro('Setup complete!')
