import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const APP_DIR = path.join(DIST_DIR, 'Casio-fx991EX-ClassWiz');
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const CACHE_ZIP = path.join(localAppData, 'electron', 'Cache', 'electron-v34.5.8-win32-x64.zip');
const TARGET_EXE = path.join(APP_DIR, 'Casio-fx991EX-ClassWiz.exe');

console.log('--- Building Casio fx-991EX ClassWiz Desktop (.exe) ---');

fs.mkdirSync(DIST_DIR, { recursive: true });

// 1. Unpack Electron if needed
if (!fs.existsSync(TARGET_EXE)) {
  console.log('Extracting Electron runtime from cache...');
  if (!fs.existsSync(CACHE_ZIP)) {
    throw new Error(`Electron zip cache not found at ${CACHE_ZIP}`);
  }
  fs.mkdirSync(APP_DIR, { recursive: true });
  const escapedZip = CACHE_ZIP.replace(/'/g, "''");
  const escapedDest = APP_DIR.replace(/'/g, "''");
  execSync(`powershell.exe -NoProfile -Command "Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDest}' -Force"`, {
    stdio: 'inherit'
  });

  const srcExe = path.join(APP_DIR, 'electron.exe');
  if (fs.existsSync(srcExe)) {
    fs.renameSync(srcExe, TARGET_EXE);
    console.log('Renamed electron.exe to Casio-fx991EX-ClassWiz.exe');
  }
} else {
  console.log('Electron binary already extracted at', TARGET_EXE);
}

// 2. Prepare resources/app
const destAppDir = path.join(APP_DIR, 'resources', 'app');
if (fs.existsSync(destAppDir)) {
  fs.rmSync(destAppDir, { recursive: true, force: true });
}
fs.mkdirSync(destAppDir, { recursive: true });

// Function to copy directory recursively
function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// 3. Copy application assets into resources/app
console.log('Updating application code and assets in resources/app...');
copyDirSync(path.join(ROOT_DIR, 'css'), path.join(destAppDir, 'css'));
copyDirSync(path.join(ROOT_DIR, 'js'), path.join(destAppDir, 'js'));
copyDirSync(path.join(ROOT_DIR, 'assets'), path.join(destAppDir, 'assets'));
fs.copyFileSync(path.join(ROOT_DIR, 'index.html'), path.join(destAppDir, 'index.html'));
if (fs.existsSync(path.join(ROOT_DIR, 'popout.html'))) {
  fs.copyFileSync(path.join(ROOT_DIR, 'popout.html'), path.join(destAppDir, 'popout.html'));
}
if (fs.existsSync(path.join(ROOT_DIR, 'sw.js'))) {
  fs.copyFileSync(path.join(ROOT_DIR, 'sw.js'), path.join(destAppDir, 'sw.js'));
}
fs.copyFileSync(path.join(ROOT_DIR, 'electron-main.cjs'), path.join(destAppDir, 'electron-main.cjs'));
fs.copyFileSync(path.join(ROOT_DIR, 'manifest.webmanifest'), path.join(destAppDir, 'manifest.webmanifest'));

// Create app package.json
const appPkg = {
  name: 'casio-991ex-classwiz',
  version: '1.0.0',
  description: 'Casio fx-991EX ClassWiz Desktop Calculator',
  main: 'electron-main.cjs'
};
fs.writeFileSync(path.join(destAppDir, 'package.json'), JSON.stringify(appPkg, null, 2));

console.log('--- Build Successful! ---');
console.log('Standalone Executable Location:');
console.log(TARGET_EXE);
