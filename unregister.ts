import * as p from '@clack/prompts'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const CONFIG_FILE = join(homedir(), '.config', 'opencode', 'opencode.json')
const PLUGIN_ENTRY_PATH = resolve(dirname(import.meta.path), 'src', 'index.ts')
const PLUGIN_URL = pathToFileURL(PLUGIN_ENTRY_PATH).href

function readConfig(): Record<string, unknown> {
	if (!existsSync(CONFIG_FILE)) {
		p.log.warn(`Config file not found: ${CONFIG_FILE}`)
		p.log.info('Nothing to unregister.')
		process.exit(0)
	}
	try {
		return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as Record<string, unknown>
	} catch {
		p.log.warn(`Could not parse ${CONFIG_FILE}.`)
		process.exit(1)
	}
}

p.intro('OpenCode Plugin Unregister')

const config = readConfig()
// V2 config shape: `plugins` entries are strings or { package, options } objects.
// Also tolerate legacy V1 entries (string or [package, options] tuple) on read.
type PluginEntry =
	| string
	| [string, Record<string, unknown>]
	| { package: string; options?: Record<string, unknown> }
const plugins: PluginEntry[] = Array.isArray(config.plugins ?? config.plugin)
	? ((config.plugins ?? config.plugin) as PluginEntry[])
	: []

function entryMatches(entry: PluginEntry): boolean {
	if (typeof entry === 'string') return entry === PLUGIN_URL
	if (Array.isArray(entry)) return entry[0] === PLUGIN_URL
	return entry.package === PLUGIN_URL
}

if (!plugins.some(entryMatches)) {
	p.note(PLUGIN_URL, 'Not registered')
	p.outro('Plugin is not in your global OpenCode config. Nothing to remove.')
	process.exit(0)
}

p.note([`Plugin URL  : ${PLUGIN_URL}`, `Config file : ${CONFIG_FILE}`].join('\n'), 'Will remove')

const confirmed = await p.confirm({
	message: `Remove this plugin from ${CONFIG_FILE}?`,
	initialValue: true,
})

if (p.isCancel(confirmed) || !confirmed) {
	p.cancel('Unregister cancelled.')
	process.exit(0)
}

const sWrite = p.spinner()
sWrite.start('Updating config...')

config.plugins = plugins.filter((entry) => !entryMatches(entry))
// Drop an empty legacy V1 `plugin` key if we migrated off it.
if (Array.isArray(config.plugin)) delete config.plugin
writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8')

sWrite.stop('Config updated.')

p.note(
	[
		`✓ Removed   : ${PLUGIN_URL}`,
		`✓ Config    : ${CONFIG_FILE}`,
		'',
		'Restart OpenCode for the change to take effect.',
		'To re-register run: bun run setup',
	].join('\n'),
	'Done',
)

p.outro('Plugin unregistered successfully!')
