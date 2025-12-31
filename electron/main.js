const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;

// Disable hardware acceleration for better compatibility
// This must be called BEFORE app.ready
app.disableHardwareAcceleration();

// Add Windows-specific command line switches
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
  app.commandLine.appendSwitch('disable-site-isolation-trials');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-ipc-flooding-protection');
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');
  app.commandLine.appendSwitch('in-process-gpu');
}

function ensureUserDataPath() {
  const userDataPath = app.getPath('userData');
  const backupsPath = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupsPath)) {
    fs.mkdirSync(backupsPath, { recursive: true });
  }
  console.log('✅ User Data Path:', userDataPath);
  return userDataPath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    title: 'نظام الحضور والانصراف',
    icon: isDev
      ? path.join(__dirname, '../icon.png')
      : path.join(process.resourcesPath, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev,
      backgroundThrottling: false,
      offscreen: false,
      webSecurity: !isDev,
      spellcheck: false,
      enablePreferredSizeMode: true
    },
    show: false,
    backgroundColor: '#ffffff',
    frame: true,
    thickFrame: true,
    hasShadow: true,
    titleBarStyle: 'default',
    transparent: false,
    vibrancy: 'none'
  });

  mainWindow.setMenuBarVisibility(false);
  
  // Set app user model ID for Windows taskbar
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.attendance.system');
  }

  // Handle window state
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.platform === 'win32') {
      mainWindow.focus();
      mainWindow.focusOnWebView();
    }
  });

  // Prevent dev tools in production
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isDev && (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
      event.preventDefault();
    }
  });

  // Disable context menu in production
  mainWindow.webContents.on('context-menu', (e) => {
    if (!isDev) e.preventDefault();
  });

  // Fix focus issues on Windows
  mainWindow.on('focus', () => {
    if (process.platform === 'win32') {
      setTimeout(() => {
        mainWindow.webContents.focus();
      }, 100);
    }
  });

  mainWindow.on('restore', () => {
    if (process.platform === 'win32') {
      setTimeout(() => {
        mainWindow.focus();
        mainWindow.webContents.focus();
      }, 200);
    }
  });

  mainWindow.on('show', () => {
    if (process.platform === 'win32') {
      setTimeout(() => {
        mainWindow.focus();
      }, 100);
    }
  });

  // Handle blur events
  mainWindow.on('blur', () => {
    // Send message to renderer to handle blur
    mainWindow.webContents.send('window-blur');
  });

  mainWindow.on('focus', () => {
    // Send message to renderer to handle focus
    mainWindow.webContents.send('window-focus');
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexPath = path.join(app.getAppPath(), 'frontend/dist/index.html');
    console.log('📂 Loading index.html from:', indexPath);

    mainWindow.loadFile(indexPath).catch(err => {
      console.error('❌ Failed to load index.html:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (process.platform === 'win32') {
      setTimeout(() => {
        mainWindow.focus();
        mainWindow.webContents.focus();
      }, 300);
    }
  });

  // Inject CSS to fix input issues
  mainWindow.webContents.on('dom-ready', () => {
    if (process.platform === 'win32') {
      mainWindow.webContents.insertCSS(`
        *:focus {
          outline: 2px solid #0078d7 !important;
          outline-offset: 2px !important;
        }
        
        input, textarea, select {
          -webkit-user-select: text !important;
          user-select: text !important;
          cursor: text !important;
        }
        
        input:focus, textarea:focus, select:focus {
          background-color: white !important;
          border-color: #0078d7 !important;
        }
      `);
    }
  });
}

function startBackendServer() {
  return new Promise((resolve, reject) => {
    const userDataPath = ensureUserDataPath();

    if (isDev) {
      console.log('⚠️ Dev mode: backend already running');
      return resolve();
    }

    let serverPath = path.join(
      process.resourcesPath,
      'app.asar.unpacked/backend/server.js'
    );

    if (!fs.existsSync(serverPath)) {
      serverPath = path.join(app.getAppPath(), 'backend/server.js');
    }

    console.log('🚀 Starting backend server...');
    console.log('📂 Server path:', serverPath);

    serverProcess = spawn(process.execPath, [serverPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        USER_DATA_PATH: userDataPath,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: 3001
      },
      detached: true
    });

    let started = false;

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[SERVER]', msg);
      if (!started && (msg.includes('Server running') || msg.includes('3001'))) {
        started = true;
        console.log('✅ Backend server is LIVE');
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[SERVER ERROR]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('❌ Backend failed:', err);
      reject(err);
    });

    setTimeout(() => {
      if (!started) {
        console.log('⚠️ Backend timeout – continuing');
        resolve();
      }
    }, 10000);
  });
}

// App lifecycle
app.on('ready', async () => {
  try {
    await startBackendServer();
    
    // Extra delay for Windows focus handling
    if (process.platform === 'win32') {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    createWindow();
  } catch (err) {
    console.error('❌ App startup failed:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
    } catch (e) {
      console.log('Error killing server:', e);
    }
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill('SIGKILL');
    } catch (e) {
      console.log('Error killing server:', e);
    }
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else if (process.platform === 'win32') {
    mainWindow.show();
    setTimeout(() => {
      mainWindow.focus();
      mainWindow.webContents.focus();
    }, 200);
  }
});

// IPC handlers for focus management
ipcMain.on('request-focus', (event) => {
  if (mainWindow) {
    mainWindow.focus();
    mainWindow.webContents.focus();
  }
});

ipcMain.on('fix-input-focus', (event) => {
  if (mainWindow) {
    mainWindow.webContents.send('force-input-focus');
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});