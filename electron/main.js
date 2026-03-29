const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

/**
 * Finding a free port to avoid conflicts.
 */
/**
 * Finding a free port to avoid conflicts.
 * In production, we use a stable port (32123) to ensure localStorage 
 * (which is origin-bound) persists between app restarts.
 */
function getFreePort() {
    return new Promise((resolve) => {
        const isDev = process.env.NODE_ENV === 'development';
        if (!isDev) {
            return resolve(32123);
        }

        const srv = http.createServer();
        srv.listen(0, () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
    });
}

async function createWindow() {
    const port = await getFreePort();
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev) {
        // In production, use the bundled node.exe in extraResources
        const nodeBinaryPath = path.join(process.resourcesPath, 'node.exe');
        
        // Standalone dir is in resources/app/.next/standalone
        const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
        const serverPath = path.join(standaloneDir, 'server.js');
        
        console.log(`Starting server with binary: ${nodeBinaryPath}`);
        console.log(`Server path: ${serverPath}`);

        serverProcess = spawn(nodeBinaryPath, [serverPath], {
            env: { 
                ...process.env, 
                PORT: port,
                NODE_ENV: 'production',
                HOSTNAME: 'localhost'
            },
            cwd: standaloneDir
        });

        serverProcess.stdout.on('data', (data) => console.log(`Server: ${data}`));
        serverProcess.stderr.on('data', (data) => console.error(`Server Error: ${data}`));
    }

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "MythForge",
        icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            zoomFactor: 1.0
        }
    });

    const url = isDev ? 'http://localhost:3000' : `http://localhost:${port}`;

    // Wait for server to be ready in production
    if (!isDev) {
        let attempts = 0;
        const checkServer = () => {
            http.get(url, (res) => {
                mainWindow.loadURL(url);
            }).on('error', () => {
                attempts++;
                if (attempts < 20) setTimeout(checkServer, 500);
            });
        };
        checkServer();
    } else {
        mainWindow.loadURL(url);
    }

    // Disable Electron's built-in pinch-to-zoom and Ctrl+Scroll zoom.
    // These fire at the native level before web JS can intercept them.
    // MythForge implements its own canvas zoom via Ctrl+Scroll in the app.
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setZoomFactor(1);
        mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Ensure data persistence is in a clear location
app.setAppLogsPath(); // Enable logging
// app.setPath('userData', path.join(app.getPath('appData'), 'MythForge'));

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (serverProcess) serverProcess.kill();
        app.quit();
    }
});

app.on('will-quit', () => {
    if (serverProcess) serverProcess.kill();
});
