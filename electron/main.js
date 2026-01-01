const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;

// ✅ FIX 1: Disable hardware acceleration BEFORE app.ready
app.disableHardwareAcceleration();

// ✅ FIX 2: Add these flags for better Windows compatibility
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('no-sandbox');
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
     paintWhenInitiallyHidden: true,
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
      // ✅ FIX 3: Disable hardware acceleration in webPreferences too
      hardwareAcceleration: false
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
  
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.attendance.system');
  }

  // ✅ FIX 4: Show window immediately after ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    
    // Force refresh after showing
    if (!isDev) {
      setTimeout(() => {
        mainWindow.webContents.reload();
      }, 500);
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isDev && (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('context-menu', (e) => {
    if (!isDev) e.preventDefault();
  });

  // ✅ FIX 5: Better focus management
  mainWindow.on('focus', () => {
    mainWindow.webContents.focus();
  });

  mainWindow.on('restore', () => {
    setTimeout(() => {
      mainWindow.focus();
      mainWindow.webContents.focus();
    }, 100);
  });

  mainWindow.on('show', () => {
    setTimeout(() => {
      mainWindow.focus();
    }, 50);
  });

  mainWindow.on('blur', () => {
    mainWindow.webContents.send('window-blur');
  });

  mainWindow.on('focus', () => {
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

  // ✅ FIX 6: Force repaint after load
  mainWindow.webContents.on('did-finish-load', () => {
    if (!isDev) {
      setTimeout(() => {
        mainWindow.webContents.invalidate();
      }, 200);
    }
  });

  // ✅ FIX 7: Inject CSS to prevent input lag
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.insertCSS(`
      * {
        -webkit-app-region: no-drag;
      }
      
      input, textarea, select, button {
        -webkit-user-select: text !important;
        user-select: text !important;
        cursor: text !important;
        pointer-events: auto !important;
      }
      
      input:focus, textarea:focus, select:focus {
        outline: 2px solid #0078d7 !important;
        outline-offset: 1px !important;
      }
      
      button {
        cursor: pointer !important;
      }
    `);
  });
}

function startBackendServer() {
  return new Promise((resolve, reject) => {
    const userDataPath = ensureUserDataPath();
    
    // Set environment variable for backend
    process.env.USER_DATA_PATH = userDataPath;

    if (isDev) {
      console.log('⚠️ Dev mode: backend already running');
      return resolve();
    }

    // In production, the backend is bundled
    let serverPath;
    
    // Try different paths for production
    if (app.isPackaged) {
      // When packaged
      serverPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'server.js');
      
      // If not found, try alternative path
      if (!fs.existsSync(serverPath)) {
        serverPath = path.join(__dirname, '..', 'backend', 'server.js');
      }
    } else {
      // In development
      serverPath = path.join(__dirname, '..', 'backend', 'server.js');
    }

    console.log('🚀 Starting backend server from:', serverPath);

    // Check if file exists
    if (!fs.existsSync(serverPath)) {
      console.error('❌ Backend server file not found:', serverPath);
      reject(new Error('Backend server file not found'));
      return;
    }

    serverProcess = spawn(process.execPath, [serverPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        USER_DATA_PATH: userDataPath,
        ELECTRON_RUN_AS_NODE: '1'
      },
      detached: false
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

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!started) {
        console.log('⚠️ Backend timeout – assuming it started');
        resolve();
      }
    }, 30000);
  });
}

app.on('ready', async () => {
  try {
    await startBackendServer();
    
    // ✅ FIX 8: Shorter delay in production
    if (!isDev) {
      await new Promise(resolve => setTimeout(resolve, 1500));
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
  } else {
    mainWindow.show();
    setTimeout(() => {
      mainWindow.focus();
      mainWindow.webContents.focus();
    }, 100);
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