const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// Check environment
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../icon.png'),
    autoHideMenuBar: true,
    title: 'نظام الحضور والانصراف'
  });

  if (isDev) {
    // Development mode → load Vite server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode → load built frontend
    mainWindow.loadFile(
      path.join(__dirname, '../frontend/dist/index.html')
    );
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startBackendServer() {
  const serverPath = path.join(__dirname, '../backend/server.js');

  console.log('Starting backend server from:', serverPath);
  console.log('isDev:', isDev);
  console.log('userData path:', app.getPath('userData'));

  serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      NODE_ENV: isDev ? 'development' : 'production',
      USER_DATA_PATH: app.getPath('userData')
    }
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start backend server:', error);
  });

  serverProcess.on('close', (code) => {
    console.log(`Backend server exited with code ${code}`);
  });
}

app.on('ready', () => {
  startBackendServer();

  // Give backend 2 seconds to start
  setTimeout(createWindow, 2000);
});

app.on('window-all-closed', function () {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
