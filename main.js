const { app, BrowserWindow, Menu, dialog, shell } = require('electron');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    resizable: true,     // Restores manual resizing
    maximizable: true,   // Restores the square maximize button
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Exit MC-OS' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' } // Restores Fullscreen functionality
      ]
    },
    {
      label: 'Repository',
      submenu: [
        {
          label: 'View Source Code',
          click: async () => {
            await shell.openExternal('https://github.com/alexelzx/MC-OS');
          }
        },
        {
          label: 'Open License (AGPL v3)',
          click: async () => {
            await shell.openExternal('https://github.com/alexelzx/MC-OS/blob/main/LICENSE');
          }
        }
      ]
    },
    {
      label: 'Credits',
      click: () => {
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'Software Credits',
          message: 'MC-OS National Administration Desktop',
          detail: 'Engineered and Developed by:\nAlexios ELIZALDE XIROKOSTA\n\n© 2026 All Rights Reserved.\n\nStatus: 100% Offline.'
        });
      }
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  win.loadFile('MC-OS.html'); 
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});