const { app, BrowserWindow, Tray, nativeImage, screen, Menu, shell, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';
const WIN_WIDTH = 380;
const WIN_HEIGHT = 640;

let tray = null;
let panelWin = null;   // menu bar popup panel
let expandedWin = null; // full resizable window
let pendingDeepLink = null;
let updateReady = false;

// ── Deep link (todone:// custom protocol) ────────────────────────────────────

// Register todone:// scheme (dev mode needs execPath + argv[1])
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('todone', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('todone');
}

function dispatchDeepLink() {
  if (!pendingDeepLink) return;
  const win = panelWin || expandedWin;
  if (!win || win.isDestroyed()) return;
  win.webContents.send('auth-deep-link', pendingDeepLink);
  pendingDeepLink = null;
  if (!win.isVisible()) {
    try {
      if (win === panelWin && tray) {
        const { x, y } = getPanelPosition();
        win.setPosition(x, y, false);
      }
      win.show();
      win.focus();
    } catch (e) { /* ignore */ }
  }
}

// macOS: fires when the protocol URL opens while app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  pendingDeepLink = url;
  dispatchDeepLink();
});

// ── Auto-updater ──────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    // Update downloads automatically in background
  });

  autoUpdater.on('update-downloaded', () => {
    updateReady = true;
    // Show dialog asking user to restart
    dialog.showMessageBox({
      type: 'info',
      title: 'Actualización disponible',
      message: 'To Done se actualizó. ¿Reiniciar ahora para aplicar los cambios?',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err?.message);
  });

  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'trayIconTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('To Done');

  tray.on('click', togglePanel);

  tray.on('right-click', () => {
    const template = [
      { label: 'To Done', enabled: false },
      { type: 'separator' },
    ];

    if (updateReady) {
      template.push(
        { label: 'Reiniciar para actualizar', click: () => autoUpdater.quitAndInstall() },
        { type: 'separator' },
      );
    }

    template.push(
      { label: 'Abrir en ventana', click: showExpandedWindow },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() },
    );

    const menu = Menu.buildFromTemplate(template);
    tray.popUpContextMenu(menu);
  });
}

// ── Panel window (menu bar popup) ─────────────────────────────────────────────

function createPanelWindow() {
  panelWin = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    roundedCorners: true,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  panelWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    panelWin.loadURL('http://localhost:5173');
  } else {
    panelWin.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Forward any deep link that arrived before the window was ready
  panelWin.webContents.on('did-finish-load', dispatchDeepLink);

  // Hide when focus leaves the panel
  panelWin.on('blur', () => {
    if (!panelWin.webContents.isDevToolsFocused()) {
      panelWin.hide();
    }
  });
}

function getPanelPosition() {
  const trayBounds = tray.getBounds();
  const { width: winW } = panelWin.getBounds();
  const { x: displayX, width: displayWidth } = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  }).workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winW / 2);
  const y = trayBounds.y + trayBounds.height;
  x = Math.max(displayX, Math.min(x, displayX + displayWidth - winW));

  return { x, y };
}

function togglePanel() {
  if (panelWin.isVisible()) {
    panelWin.hide();
  } else {
    const { x, y } = getPanelPosition();
    panelWin.setPosition(x, y, false);
    panelWin.show();
    panelWin.focus();
  }
}

// ── Expanded window ───────────────────────────────────────────────────────────

function createExpandedWindow() {
  expandedWin = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 600,
    minHeight: 500,
    resizable: true,
    frame: true,
    titleBarStyle: 'hiddenInset', // native macOS look
    title: 'To Done',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    expandedWin.loadURL('http://localhost:5173');
  } else {
    expandedWin.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  expandedWin.once('ready-to-show', () => {
    expandedWin.show();
    expandedWin.focus();
  });

  // Hide instead of close (keeps session alive)
  expandedWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      expandedWin.hide();
    }
  });
}

function showExpandedWindow() {
  if (!expandedWin || expandedWin.isDestroyed()) {
    createExpandedWindow();
  } else {
    expandedWin.show();
    expandedWin.focus();
  }
  // Hide the panel when opening the full window
  if (panelWin && panelWin.isVisible()) panelWin.hide();
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.on('expand-window', showExpandedWindow);

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.on('ready', () => {
  if (app.dock) app.dock.hide();
  createTray();
  createPanelWindow();
  if (!isDev) setupAutoUpdater();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

// Prevent quitting when windows are hidden
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

// Open external links in the default browser
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});
