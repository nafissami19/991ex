import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const desktopDir = path.join(os.homedir(), 'OneDrive', 'Desktop');
const shortcutPath = path.join(desktopDir, 'Casio fx-991EX ClassWiz.lnk');
const exePath = path.resolve('dist', 'Casio-fx991EX-ClassWiz', 'Casio-fx991EX-ClassWiz.exe');
const workDir = path.resolve('dist', 'Casio-fx991EX-ClassWiz');
const iconPath = path.resolve('dist', 'Casio-fx991EX-ClassWiz', 'resources', 'app', 'assets', 'icons', 'icon.ico');

const psScript = `
$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$s.TargetPath = '${exePath.replace(/'/g, "''")}'
$s.WorkingDirectory = '${workDir.replace(/'/g, "''")}'
$s.IconLocation = '${iconPath.replace(/'/g, "''")}'
$s.Description = 'Casio fx-991EX ClassWiz Scientific Calculator'
$s.Save()
`;

const tempPs = path.resolve('scripts', '_temp_shortcut.ps1');
fs.writeFileSync(tempPs, psScript, 'utf8');

try {
  execFileSync('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', tempPs], { stdio: 'inherit' });
  console.log('Successfully created Desktop shortcut at:', shortcutPath);
} finally {
  if (fs.existsSync(tempPs)) {
    fs.unlinkSync(tempPs);
  }
}
