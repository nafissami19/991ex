// Electron main process for Casio fx-991EX ClassWiz desktop release
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');

// Maintain 644 x 1250 proportion
const DESIGN = { width: 460, height: 890 };

let win;

function buildMenu() {
  const template = [
    {
      label: 'Calculator',
      submenu: [
        {
          label: 'Reset Calculator',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            win?.webContents.executeJavaScript('localStorage.clear(); location.reload();');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About fx-991EX ClassWiz',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'fx-991EX ClassWiz',
              message: 'Casio fx-991EX ClassWiz Desktop Application',
              detail: 'Pixel-accurate re-creation of the Casio fx-991EX ClassWiz scientific calculator.\nVersion 1.0.0'
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: DESIGN.width,
    height: DESIGN.height,
    minWidth: 320,
    minHeight: 600,
    backgroundColor: '#15171a',
    title: 'fx-991EX ClassWiz',
    icon: path.join(__dirname, 'assets', 'icons', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      webSecurity: false,
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${path.basename(sourceId)}:${line})`);
  });

  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
