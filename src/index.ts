import { Plugin } from '@opencode-ai/plugin'
let isSpawning = false

function isWebProcessRunning(): boolean {
	try {
		if (process.platform === 'win32') {
			const res = Bun.spawnSync(['cmd', '/c', 'tasklist /FI "IMAGENAME eq opencode.exe"'])
			// Match only the web server process, not the main OpenCode process.
			// The web server spawns as: opencode.exe web --port 5000
			return res.stdout.toString().includes('opencode web')
		}
		const res = Bun.spawnSync(['pgrep', '-f', 'opencode web'])
		return res.exitCode === 0
	} catch {
		return false
	}
}

export const OpencodeAutowebPluginPlugin: Plugin = async ({ client }) => {
	// Set the guard flag SYNCHRONOUSLY — before any await — so that
	// concurrent invocations of this plugin are blocked immediately.
	// This prevents the race condition where two calls both pass the
	// guard before either one sets the flag, resulting in a double spawn.
	if (isSpawning) return {}
	isSpawning = true

	await client.app.log({
		body: {
			service: 'opencode-autoweb-plugin',
			level: 'info',
			message: 'plugin initialized',
		},
	})

	try {
		// 1. Check OS process list — is the web server already running?
		if (isWebProcessRunning()) {
			return {}
		}

		// 2. Port-check as fallback — is something listening on port 5000?
		const res = await fetch('http://127.0.0.1:5000').catch(() => null)
		if (res) return {}

		// 3. Spawn the web server
		Bun.spawn(['opencode', 'web', '--port', '5000'], {
			stdout: 'ignore',
			stderr: 'ignore',
			detached: true,
		})
	} catch {
		// Silent fail
	}
	return {}
}

export default OpencodeAutowebPluginPlugin
