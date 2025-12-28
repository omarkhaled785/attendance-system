const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;

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
      disableHardwareAcceleration: false
    },
    show: false,
    backgroundColor: '#ffffff'
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isDev && (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('context-menu', (e) => {
    if (!isDev) e.preventDefault();
  });

  mainWindow.on('focus', () => {
    if (process.platform === 'win32') {
      mainWindow.webContents.focus();
    }
  });

  mainWindow.on('restore', () => {
    setTimeout(() => {
      mainWindow.focus();
      mainWindow.webContents.focus();
    }, 100);
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

  mainWindow.webContents.on('crashed', () => {
    console.error('❌ Renderer crashed');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (process.platform === 'win32') {
      setTimeout(() => {
        mainWindow.focus();
        mainWindow.webContents.focus();
      }, 200);
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
      }
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
    }, 7000);
  });
}

if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
  app.commandLine.appendSwitch('disable-site-isolation-trials');
}

// App lifecycle
app.on('ready', async () => {
  try {
    await startBackendServer();
    
    if (process.platform === 'win32') {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    createWindow();
  } catch (err) {
    console.error('❌ App startup failed:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill('SIGTERM');
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (serverProcess) serverProcess.kill('SIGKILL');
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else if (process.platform === 'win32') {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.focus();
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});