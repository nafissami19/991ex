import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
const progFiles = process.env.ProgramFiles || 'C:\\Program Files';

const isccCandidates = [
  path.join(localApp, 'Programs', 'Antigravity IDE', 'resources', 'app', 'node_modules', 'innosetup', 'bin', 'ISCC.exe'),
  path.join(progFilesX86, 'Inno Setup 6', 'ISCC.exe'),
  path.join(progFiles, 'Inno Setup 6', 'ISCC.exe'),
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe'
];

let isccExe = null;
for (const cand of isccCandidates) {
  if (fs.existsSync(cand)) {
    isccExe = cand;
    break;
  }
}

if (!isccExe) {
  throw new Error('ISCC.exe (Inno Setup Compiler) not found on system.');
}

console.log('--- Step 1: Ensuring application executable is built ---');
execSync('node scripts/build_exe.js', { cwd: ROOT_DIR, stdio: 'inherit' });

console.log('--- Step 2: Compiling Windows Installer (.exe) with Inno Setup ---');
const issFile = path.join(ROOT_DIR, 'scripts', 'installer.iss');
execFileSync(isccExe, [issFile], { cwd: ROOT_DIR, stdio: 'inherit' });

const setupPath = path.join(ROOT_DIR, 'dist', 'Casio-fx991EX-ClassWiz-Setup-1.0.0.exe');
console.log('--- Windows Setup Installer Built Successfully! ---');
console.log('Installer path:', setupPath);
