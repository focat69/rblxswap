const { app, BrowserWindow, nativeTheme, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const fsPromises = fs.promises;
const execFileAsync = promisify(execFile);

const isDev = !app.isPackaged;
let mainWindow;
let bypassRunning = false;

function createWindow() {
	const windowOptions = {
		width: 480,
		height: 400,
		frame: false,
		transparent: true,
		resizable: false,
		fullscreenable: false,
		show: false,
		titleBarStyle: 'hidden',
		alwaysOnTop: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			nodeIntegration: false,
			contextIsolation: true,
			devTools: isDev
		}
	};

	mainWindow = new BrowserWindow(windowOptions);

	mainWindow.once('ready-to-show', () => {
		mainWindow.show();
	});

	mainWindow.setMenuBarVisibility(false);
	mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	if (process.platform === 'win32') {
		nativeTheme.themeSource = 'dark';
	}
}

function sendToRenderer(channel, payload) {
	if (!mainWindow || mainWindow.isDestroyed()) {
		return;
	}
	mainWindow.webContents.send(channel, payload);
}

function emitLog(level, message) {
	sendToRenderer('bypass:log', {
		level,
		message,
		timestamp: Date.now()
	});
}

function emitStatus(status, progress) {
	sendToRenderer('bypass:status', {
		status,
		progress
	});
}

async function pathExists(targetPath) {
	try {
		await fsPromises.access(targetPath, fs.constants.F_OK);
		return true;
	} catch (error) {
		return false;
	}
}

async function removeDirectory(targetPath, label) {
	try {
		const exists = await pathExists(targetPath);
		if (!exists) {
			emitLog('info', `${label} already clean`);
			return false;
		}

		await fsPromises.rm(targetPath, { recursive: true, force: true });
		emitLog('success', `${label} removed`);
		return true;
	} catch (error) {
		emitLog('warn', `Failed to remove ${label}: ${error.message}`);
		return false;
	}
}

async function terminateRobloxProcesses() {
	if (process.platform !== 'win32') {
		emitLog('warn', 'Process termination step skipped (Windows only)');
		return;
	}

	const processNames = [
		'RobloxPlayerBeta.exe',
		'RobloxPlayerLauncher.exe',
		'RobloxStudioBeta.exe',
		'RobloxCrashHandler.exe',
		'RobloxPlayerBeta'
	];

	let terminatedAny = false;

	for (const name of processNames) {
		try {
			await execFileAsync('taskkill', ['/IM', name, '/F']);
			emitLog('success', `Terminated ${name}`);
			terminatedAny = true;
		} catch (error) {
			if (error.code === 'ENOENT') {
				emitLog('warn', 'taskkill command unavailable; skipping process termination step');
				return;
			}
			const stderr = error?.stderr || '';
			if (stderr.includes('not found') || stderr.includes('No tasks are running')) {
				// emitLog('info', `${name} was not running`);
			} else {
				emitLog('warn', `Unable to terminate ${name}: ${error.message}`);
			}
		}
	}

	if (!terminatedAny) {
		emitLog('info', 'No Roblox processes were running');
	}
}

async function cleanLauncherInstallations(localAppData) {
	const launchers = ['Fishstrap', 'Bloxstrap', 'Voidstrap']; //! prolly need to add support for more
	const launcherSubFolders = ['Versions', 'Logs', 'Downloads'];
	let detected = false;

	for (const launcherName of launchers) {
		const launcherRoot = path.join(localAppData, launcherName);
		const exists = await pathExists(launcherRoot);
		if (!exists) {
			continue;
		}

		detected = true;
		emitLog('info', `Detected ${launcherName} installation`);
		for (const folderName of launcherSubFolders) {
			await removeDirectory(path.join(launcherRoot, folderName), `${launcherName} / ${folderName}`);
		}
	}

	if (!detected) {
		emitLog('info', 'No Fishstrap/Bloxstrap/Voidstrap folders detected');
	}
}

async function deletePrefetchArtifacts() { //? PROBABLY not needed but eh whatever
	const systemRoot = process.env.SystemRoot || 'C:/Windows';
	const prefetchDir = path.join(systemRoot, 'Prefetch');

	if (!(await pathExists(prefetchDir))) {
		emitLog('warn', 'Prefetch directory not accessible, so we skip!');
		return;
	}

	try {
		const entries = await fsPromises.readdir(prefetchDir);
		const targets = entries.filter((fileName) =>
			(fileName.startsWith('ROBLOXCRASHHANDLER.EXE-') || fileName.startsWith('ROBLOXPLAYERBETA.EXE-')) &&
			fileName.toUpperCase().endsWith('.PF')
		);

		if (targets.length === 0) {
			emitLog('info', 'No Roblox prefetch files detected');
			return;
		}

		await Promise.all(
			targets.map(async (fileName) => {
				const targetPath = path.join(prefetchDir, fileName);
				try {
					await fsPromises.rm(targetPath, { force: true });
					emitLog('success', `Deleted Prefetch ${fileName}`);
				} catch (error) {
					emitLog('warn', `Failed to delete Prefetch ${fileName}: ${error.message}`);
				}
			})
		);
	} catch (error) {
		emitLog('warn', `Unable to enumerate thru prefetch: ${error.message}`);
	}
}

async function deleteRegistryKey() {
	try {
		await execFileAsync('reg', ['delete', 'HKCU\\Software\\ROBLOX Corporation', '/f']);
		emitLog('success', 'Removed Roblox registry keys');
	} catch (error) {
		if (error.code === 1) {
			emitLog('info', 'Registry keys already absent');
		} else {
			emitLog('warn', `Failed to delete registry key: ${error.message}`);
		}
	}
}

async function cleanRobloxRoaming() {
	const appData = process.env.APPDATA;
	if (!appData) { // just in case bro 😭😭😭😭
		emitLog('warn', 'APPDATA environment variable missing??? tf??????????????');
		return;
	}

	const base = path.join(appData, 'Roblox');
	const subfolders = ['logs', 'http'];
	const exists = await pathExists(base);

	if (!exists) {
		emitLog('info', 'Roaming/Roblox not found');
		return;
	}

	for (const folder of subfolders) {
		await removeDirectory(path.join(base, folder), `Roaming Roblox / ${folder}`);
	}
}

async function cleanTempCaches() {
	const tempRoot = process.env.TEMP || os.tmpdir();
	await removeDirectory(path.join(tempRoot, 'Roblox'), 'Temp Roblox cache');
	await removeDirectory(path.join(tempRoot, 'RobloxLogs'), 'Temp RobloxLogs cache');

	try {
		const entries = await fsPromises.readdir(tempRoot, { withFileTypes: true });
		const matches = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith('Roblox'));
		if (matches.length === 0) {
			emitLog('info', 'No additional Roblox temp directories detected');
			return;
		}

		for (const match of matches) {
			await removeDirectory(path.join(tempRoot, match.name), `Temp ${match.name}`);
		}
	} catch (error) {
		emitLog('warn', `Unable to enumerate thru temp dir: ${error.message}`);
	}
}

async function removeProgramDataRoblox() {
	const programData = process.env.PROGRAMDATA;
	if (!programData) { // again, just in case... although if this is missing something is really wrong with their system ngl
		emitLog('warn', 'PROGRAMDATA environment variable missing??? tf WTFF x2 ??????????????');
		return;
	}

	await removeDirectory(path.join(programData, 'Roblox'), 'ProgramData Roblox');
}

async function runBypassWorkflow() {
	const localAppData = process.env.LOCALAPPDATA;
	if (!localAppData) { // you alraedy kno
		throw new Error('LOCALAPPDATA environment variable is not defined????????????????????????????????????????? WTF');
	}

	emitLog('info', 'Yo veo roblox... Bypassing np');

	//?         label,                         progress
	emitStatus('terminating Roblox processes', 5);
	await terminateRobloxProcesses();

	// wait a few sec for roblox to completely shut off
	emitStatus('waiting for roblox', 5);
	await new Promise((resolve) => setTimeout(resolve, 2000));

	emitStatus('detecting launchers', 15);
	await cleanLauncherInstallations(localAppData);

	emitStatus('purging Roblox install', 35);
	await removeDirectory(path.join(localAppData, 'Roblox'), 'Roblox install folder');
        if (process.env.ProgramFiles) await removeDirectory(path.join(process.env.ProgramFiles, 'Roblox'), 'Program Files Roblox');
        if (process.env['ProgramFiles(x86)']) await removeDirectory(path.join(process.env['ProgramFiles(x86)'], 'Roblox'), 'Program Files (x86) Roblox');


	emitStatus('cleaning Roaming cache', 45);
	await cleanRobloxRoaming();

	emitStatus('clearing Prefetch cache', 60);
	await deletePrefetchArtifacts();

	emitStatus('removing registry keys', 75);
	await deleteRegistryKey();

	emitStatus('clearing temp cache', 88);
	await cleanTempCaches();

	emitStatus('cleaning ProgramData', 94);
	await removeProgramDataRoblox();

	emitStatus('complete', 100);
	emitLog('success', 'Bypassed np thx');
}

app.whenReady().then(() => {
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

ipcMain.handle('bypass:run', async () => {
	if (bypassRunning) { // again, debounce safety precaution for silly people
		emitLog('warn', 'WHO IS THIS???'); // already running bud
		return { success: false, reason: 'busy' };
	}

	bypassRunning = true;
	emitStatus('starting', 0);

	try {
		await runBypassWorkflow();
		sendToRenderer('bypass:complete', { success: true });
		return { success: true };
	} catch (error) {
		emitLog('error', error.message || 'Unexpected fail');
		emitStatus('error', 100);
		sendToRenderer('bypass:complete', { success: false, message: error.message });
		return { success: false, message: error.message };
	} finally {
		bypassRunning = false;
	}
});

// mac address & auth handling
//! special thanks & credit to https://github.com/centerepic/ByeBanAsync for MAC spoofing logic / registry techniques!
//! i originally did it wrong and it was a nightmare lol
ipcMain.handle('mac:get-adapters', async () => {
	try {
		const { stdout } = await execFileAsync('powershell', [
			'-NoProfile',
			'-Command',
			'@(Get-NetAdapter -Physical | Select-Object Name, InterfaceDescription, MacAddress, Status) | ConvertTo-Json -Compress'
		]);
		return JSON.parse(stdout || '[]');
	} catch (err) {
		return [];
	}
});

ipcMain.handle('mac:get-stats', async () => {
	try {
		const { stdout } = await execFileAsync('powershell', [
			'-NoProfile',
			'-Command',
			'@(Get-NetAdapterStatistics | Select-Object Name, ReceivedBytes, SentBytes) | ConvertTo-Json -Compress'
		]);
		return JSON.parse(stdout || '[]');
	} catch (err) {
		return [];
	}
});

ipcMain.handle('mac:spoof', async (e, adapterDesc, newMac) => {
	//* we use the this key (4d36e972-e3...) to target network adapters! why? 
	//* because adapter names can be localized and also can be changed by the user, 
	//* but the description is consistent and unchangeable 
	//* (at least without modifying driver files which is a whole other level of pain!)
	const script = `
		$adapters = Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}\\0*" -ErrorAction SilentlyContinue | Where-Object { $_.DriverDesc -eq '${adapterDesc.replace(/'/g, "''")}' }
		if ($adapters) {
				$path = $adapters[0].PSPath
				Set-ItemProperty -Path $path -Name "NetworkAddress" -Value "${newMac.replace(/-/g, '')}" -ErrorAction Stop

				# spoof MachineGuid to foil hardware detection
				$guid = [guid]::NewGuid().ToString().ToLower()
				Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Cryptography" -Name "MachineGuid" -Value $guid -ErrorAction SilentlyContinue

				Write-Output "SUCCESS"
		} else {
				Write-Output "NOT_FOUND"
		}
	`; // we gettin flagged with this one
	try {
		const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
		return stdout.trim() === 'SUCCESS';
	} catch (error) {
		return false;
	}
});

ipcMain.handle('mac:reset', async (e, adapterDesc) => {
	const script = `
		$adapters = Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e972-e325-11ce-bfc1-08002be10318}\\0*" -ErrorAction SilentlyContinue | Where-Object { $_.DriverDesc -eq '${adapterDesc.replace(/'/g, "''")}' }
		if ($adapters) {
				$path = $adapters[0].PSPath
				Remove-ItemProperty -Path $path -Name "NetworkAddress" -ErrorAction SilentlyContinue
				Write-Output "SUCCESS"
		} else {
				Write-Output "NOT_FOUND"
		}
	`;
	try {
		const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
		return stdout.trim() === 'SUCCESS';
	} catch (error) {
		return false;
	}
});

ipcMain.handle('mac:restart-adapter', async (e, adapterName) => {
	// disables/enables adapter to apply changes
	const script = `
		Disable-NetAdapter -Name '${adapterName.replace(/'/g, "''")}' -Confirm:$false -ErrorAction Continue
		Enable-NetAdapter -Name '${adapterName.replace(/'/g, "''")}' -Confirm:$false -ErrorAction Continue
		Write-Output "SUCCESS"
	`;
	try {
		const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
		return stdout.trim() === 'SUCCESS';
	} catch (error) {
		return false;
	}
});

ipcMain.handle('mac:dhcp-refresh', async () => { //? to get new localip np
	try {
		await execFileAsync('ipconfig', ['/release']);
		await execFileAsync('ipconfig', ['/renew']);
		return true;
	} catch (error) {
		return false;
	}
});
