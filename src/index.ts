import { Plugin } from '@opencode-ai/plugin'

let isSpawning = false

function isWebProcessRunning(): boolean {
	try {
		if (process.platform === 'win32') {
			const res = Bun.spawnSync(['cmd', '/c', 'tasklist /FI "IMAGENAME eq opencode.exe"'])
			return res.stdout.toString().includes('opencode')
		}
		const res = Bun.spawnSync(['pgrep', '-f', 'opencode web'])
		return res.exitCode === 0
	} catch {
		return false
	}
}

export const OpencodeAutowebPluginPlugin: Plugin = async ({ client }) => {
	if (isSpawning) return {}

	await client.app.log({
		body: {
			service: 'opencode-autoweb-plugin',
			level: 'info',
			message: 'plugin initialized',
		},
	})

	try {
		// 1. Direkt in der Prozessliste des OS prüfen
		if (isWebProcessRunning()) {
			return {}
		}

		// 2. Port-Check als Fallback
		const res = await fetch('http://127.0.0.1:5000').catch(() => null)
		if (res) return {}

		// 3. Lock setzen und Prozess starten
		isSpawning = true
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
