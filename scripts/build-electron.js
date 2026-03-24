const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

function run() {
    console.log('--- Starting Next.js Build ---');
    execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

    console.log('--- Preparing Standalone Folder ---');
    
    // Copy static assets to standalone folder as required by Next.js standalone mode
    const staticSrc = path.join(rootDir, '.next', 'static');
    const publicSrc = path.join(rootDir, 'public');
    const staticDst = path.join(standaloneDir, '.next', 'static');
    const publicDst = path.join(standaloneDir, 'public');

    if (fs.existsSync(staticSrc)) {
        fs.ensureDirSync(staticDst);
        fs.copySync(staticSrc, staticDst);
        console.log('Copied .next/static to standalone folder');
    }

    if (fs.existsSync(publicSrc)) {
        fs.ensureDirSync(publicDst);
        fs.copySync(publicSrc, publicDst);
        console.log('Copied public/ to standalone folder');
    }

    // NEW: Copy node.exe to a bin folder in root for electron-builder to pick up as extraResource
    const binDir = path.join(rootDir, 'bin');
    fs.ensureDirSync(binDir);
    const nodePath = 'C:\\Program Files\\nodejs\\node.exe'; // From previous where.exe call
    if (fs.existsSync(nodePath)) {
        fs.copySync(nodePath, path.join(binDir, 'node.exe'));
        console.log('Bundled node.exe in /bin');
    } else {
        console.error('CRITICAL: Could not find node.exe to bundle!');
    }

    // Use electron-packager to bundle the app
    console.log('--- Running Electron Packager ---');
    const packager = require('electron-packager');
    
    const packagerOptions = {
        dir: rootDir,
        out: 'dist',
        name: 'MythForge BETA 1.1',
        executableName: 'MythForge-BETA-1.1',
        platform: 'win32',
        arch: 'x64',
        overwrite: true,
        asar: false, 
        ignore: [
            /^\/src/,
            /^\/\.git/,
            /^\/\.builder-cache/,
            /^\/\.next\/(?!standalone)/, // Ignore .next except for standalone
            /^\/node_modules(?!\/electron)/, // Ignore project node_modules except electron
        ],
        extraResource: [
            path.join(rootDir, 'bin', 'node.exe')
        ],
        win32opts: {
            icon: path.join(rootDir, 'public', 'favicon.ico')
        }
    };

    packager(packagerOptions).then(appPaths => {
        console.log(`--- Build Complete! App created at: ${appPaths[0]} ---`);
    }).catch(err => {
        console.error('--- Packager Error ---');
        console.error(err);
        process.exit(1);
    });
}

run();
